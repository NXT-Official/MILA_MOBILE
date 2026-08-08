import { useMutation, useQueryClient } from "@tanstack/react-query";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";

import {
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  type SignInInput,
  type SignUpInput,
} from "@/services/api/auth";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

export function useSignIn() {
  return useMutation({
    mutationFn: (input: SignInInput) => signIn(input),
    // Never auto-retry: a retry burns the single-use captcha token and the
    // second attempt fails for a reason the member cannot act on.
    retry: false,
  });
}

export function useSignUp() {
  return useMutation({ mutationFn: (input: SignUpInput) => signUp(input), retry: false });
}

export function usePasswordReset() {
  return useMutation({ mutationFn: (email: string) => requestPasswordReset(email), retry: false });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const setSigningOut = useAuthStore((s) => s.setSigningOut);

  return useMutation({
    retry: false,
    mutationFn: async () => {
      setSigningOut(true);
      await signOut();
    },
    onSettled: () => {
      // Clear before navigating: a stale profile in the cache would let the
      // next member briefly see the previous one's gate result.
      queryClient.clear();
      setSigningOut(false);
      router.replace("/login");
    },
  });
}

/**
 * Google sign-in via the system browser.
 *
 * `signInWithOAuth` with `skipBrowserRedirect` gives us the provider URL, which
 * we open in an auth session; the callback returns to `mila://auth/callback`
 * carrying the tokens, which are handed to `setSession`.
 */
export function useGoogleSignIn() {
  return useMutation({
    retry: false,
    mutationFn: async () => {
      const redirectTo = makeRedirectUri({ scheme: "mila", path: "auth/callback" });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw new Error("Google sign-in is unavailable right now.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return null; // dismissed — not an error

      const params = new URL(result.url.replace("#", "?")).searchParams;
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) throw new Error("Google sign-in did not complete.");

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sessionError) throw new Error("Google sign-in did not complete.");
      return sessionData.session;
    },
  });
}
