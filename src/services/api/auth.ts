import type { Session } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/services/supabase/client";
import { trackEvent } from "@/services/supabase/analytics";

import { api, ApiError } from "./client";

/**
 * The one message every credential failure produces.
 *
 * Never distinguish a bad email from a bad password from a bad captcha — the
 * difference is an account-enumeration oracle. §3 of the architecture doc fixes
 * this string; do not reword it per-branch.
 */
export const UNIFORM_AUTH_FAILURE = "Email, password, or verification challenge is invalid.";

export type SignInInput = { email: string; password: string; captchaToken: string };
export type SignUpInput = SignInInput & { username: string };

const NATIVE_AUTH_CALLBACK = "mila://auth/callback";
export const GOOGLE_NATIVE_BUILD_REQUIRED =
  "Google sign-in needs the installed Mila app. Use email and password here.";

/** SDK 57 requires an explicit native URI for installed builds. */
export function authRedirectUri(): string {
  // Expo Go's changing exp:// address is not a production auth redirect. An
  // unregistered address silently falls back to Supabase's website Site URL.
  // Email confirmation stays tied to the installed app, even when requested
  // from Expo Go; afterwards the member can sign in here with a password.
  if (Constants.expoVersion) return NATIVE_AUTH_CALLBACK;
  return makeRedirectUri({
    native: NATIVE_AUTH_CALLBACK,
    scheme: "mila",
    path: "auth/callback",
  });
}

const CALLBACK_FAILURE = "This sign-in link could not be verified. Please sign in again.";
const pendingCallbacks = new Map<string, Promise<Session>>();

/** Handles both a browser return and an email link opening a cold app. */
export async function completeAuthCallback(url: string): Promise<Session> {
  let callback: URL;
  try {
    callback = new URL(url);
  } catch {
    throw new Error(CALLBACK_FAILURE);
  }
  const expected = new URL(authRedirectUri());
  if (
    callback.protocol !== expected.protocol ||
    callback.host !== expected.host ||
    callback.pathname !== expected.pathname ||
    callback.username ||
    callback.password
  ) {
    throw new Error(CALLBACK_FAILURE);
  }

  // Supabase's implicit flow uses the fragment; PKCE uses the query string.
  // Parse both without losing query parameters when a fragment is present.
  const params = new URLSearchParams(callback.search);
  new URLSearchParams(callback.hash.slice(1)).forEach((value, key) => params.set(key, value));
  if (params.has("error") || params.has("error_code")) throw new Error(CALLBACK_FAILURE);
  const code = params.get("code");
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!code && (!access_token || !refresh_token)) throw new Error(CALLBACK_FAILURE);
  const tokens = access_token && refresh_token ? { access_token, refresh_token } : null;

  // Android can deliver the same link to the route and openAuthSessionAsync.
  // Coalesce simultaneous exchanges, especially single-use PKCE codes.
  const pending = pendingCallbacks.get(url);
  if (pending) return pending;
  const completion = (async () => {
    if (access_token && refresh_token) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token === access_token) return data.session;
    }
    let result;
    if (code) result = await supabase.auth.exchangeCodeForSession(code);
    else if (tokens) result = await supabase.auth.setSession(tokens);
    else throw new Error(CALLBACK_FAILURE);
    const { data, error } = result;
    if (error || !data.session) throw new Error(CALLBACK_FAILURE);
    return data.session;
  })();
  pendingCallbacks.set(url, completion);
  try {
    return await completion;
  } finally {
    pendingCallbacks.delete(url);
  }
}

export async function signInWithGoogle(): Promise<Session | null> {
  // SDK 57 documents expoVersion as non-null only in Expo Go. expoGoConfig
  // can contain an embedded manifest in installed builds, so it is not a guard.
  if (Constants.expoVersion) throw new Error(GOOGLE_NATIVE_BUILD_REQUIRED);
  const redirectTo = authRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error("Google sign-in is unavailable right now. Please retry.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return null;
  return completeAuthCallback(result.url);
}

/**
 * TEMPORARY TRANSPORT SWITCH.
 *
 * §5 routes password auth through `POST /api/v1/auth/{sign-in,sign-up}` for
 * three reasons: uniform failure messaging, a server-side captcha path, and
 * structured auth-failure logging without PII.
 *
 * Those adapter routes do not exist yet (Appendix B is unbuilt), so this module
 * defaults to talking to Supabase Auth directly. Two of the three reasons still
 * hold: the uniform message is enforced below, and Supabase verifies the
 * hCaptcha token itself — this project has captcha protection ON, so a
 * tokenless request is rejected server-side with `captcha_failed`. What is lost
 * is server-side auth-failure logging.
 *
 * REMOVE THIS SWITCH when the adapter routes ship: set
 * EXPO_PUBLIC_AUTH_TRANSPORT=api, verify, then delete the `supabase` branch and
 * this comment. Callers never change — they only ever see signIn/signUp.
 */
const TRANSPORT = process.env.EXPO_PUBLIC_AUTH_TRANSPORT === "api" ? "api" : "supabase";

/** Supabase returns granular reasons; the member sees exactly one. */
function toUniformError(): ApiError {
  return new ApiError("UNAUTHENTICATED", UNIFORM_AUTH_FAILURE, 401);
}

export async function signIn(input: SignInInput): Promise<Session> {
  if (TRANSPORT === "api") {
    const { session } = await api.post<{ session: Session }>("/auth/sign-in", input);
    await supabase.auth.setSession(session);
    return session;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
    options: { captchaToken: input.captchaToken },
  });

  if (error || !data.session) {
    // Development only, and only the code — never the message, the email, or
    // the token. Without this the uniform message hides why a build cannot
    // sign in, which is correct for the member and useless for the engineer.
    if (__DEV__) console.warn("[auth] sign-in rejected:", error?.code ?? "no-session");
    throw toUniformError();
  }
  return data.session;
}

export async function signUp(input: SignUpInput): Promise<Session> {
  if (TRANSPORT === "api") {
    const { session } = await api.post<{ session: Session }>("/auth/sign-up", input);
    await supabase.auth.setSession(session);
    trackEvent(session.user.id, "signup_completed");
    return session;
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      captchaToken: input.captchaToken,
      emailRedirectTo: authRedirectUri(),
      // A `handle_new_user` trigger reads this to seed profiles.username.
      data: { username: input.username },
    },
  });

  if (error) {
    // Signup is the one place a specific message helps and leaks nothing the
    // member does not already know about their own input.
    const message = /already|exists|registered/i.test(error.message)
      ? "That email or username is already taken."
      : UNIFORM_AUTH_FAILURE;
    throw new ApiError("VALIDATION_FAILED", message, 400);
  }

  // With mailer_autoconfirm off, signUp returns a user but no session and the
  // member must confirm by email first.
  if (!data.session) {
    throw new ApiError(
      "EMAIL_CONFIRMATION_REQUIRED",
      "Check your email to confirm your account, then sign in.",
      200,
    );
  }

  trackEvent(data.session.user.id, "signup_completed");
  return data.session;
}

export async function signOut(): Promise<void> {
  // Never swallow this. Supabase returns without clearing the stored session
  // when it cannot read it, so a discarded error is a member who tapped "Sign
  // out", saw the spinner stop, and is still signed in with nothing to retry.
  const { error } = await supabase.auth.signOut();
  if (error) throw new ApiError("INTERNAL", "Mila couldn't sign you out. Please try again.", 500);
}

export async function changeEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: authRedirectUri() },
  );
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "mila://reset-password",
  });
  // Never reveal whether the address exists — the screen always shows the same
  // "if that address is registered" confirmation.
  if (error && !/not found|invalid/i.test(error.message)) {
    throw new ApiError("INTERNAL", "Mila couldn't send that email. Please try again.", 500);
  }
}

/**
 * Completes the reset started by `requestPasswordReset`. Only callable once
 * the reset-password screen has already exchanged the recovery deep link's
 * tokens for a session via `setSession` — this just updates that session's
 * password, same as any other authenticated `updateUser` call.
 */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new ApiError(
      "INTERNAL",
      "Mila couldn't update your password. Please request a new reset link.",
      500,
    );
  }
}
