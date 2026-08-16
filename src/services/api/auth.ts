import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/services/supabase/client";

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
    return session;
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      captchaToken: input.captchaToken,
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

  return data.session;
}

export async function signOut(): Promise<void> {
  // Never swallow this. Supabase returns without clearing the stored session
  // when it cannot read it, so a discarded error is a member who tapped "Sign
  // out", saw the spinner stop, and is still signed in with nothing to retry.
  const { error } = await supabase.auth.signOut();
  if (error) throw new ApiError("INTERNAL", "Mila couldn't sign you out. Please try again.", 500);
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
