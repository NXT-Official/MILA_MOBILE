import { useMutation } from "@tanstack/react-query";

import {
  requestPasswordReset,
  signIn,
  signUp,
  signInWithGoogle,
  updatePassword,
  type SignInInput,
  type SignUpInput,
} from "@/services/api/auth";

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

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (password: string) => updatePassword(password),
    retry: false,
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
    mutationFn: signInWithGoogle,
  });
}
