import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/constants/password";

/**
 * HAND-WRITTEN to the architecture doc §6 contract. The web project's
 * `src/lib/auth-input.ts` is the real source and should be copied over this
 * file (Appendix A) — the server parses with the same schemas, and a drifted
 * client schema produces a confusing double validation.
 *
 * §6: email ≤254 · password 8–128 · username 3–30 matching ^[a-zA-Z0-9_-]+$ ·
 * captchaToken 1–4000. `.strict()` on both.
 */
const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .email("That does not look like an email address.");

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, "That password is too long.");

const username = z
  .string()
  .trim()
  .min(3, "Use at least 3 characters.")
  .max(30, "Use at most 30 characters.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, hyphens, and underscores only.");

const captchaToken = z.string().min(1).max(4000);

export const Credentials = z
  .object({ email, password, captchaToken })
  .strict();

export const Signup = z
  .object({ email, password, username, captchaToken })
  .strict();

export type CredentialsInput = z.infer<typeof Credentials>;
export type SignupInput = z.infer<typeof Signup>;

/** The form validates before a captcha token exists, so it is omitted here. */
export const CredentialsForm = Credentials.omit({ captchaToken: true });
export const SignupForm = Signup.omit({ captchaToken: true });

export type CredentialsFormValues = z.infer<typeof CredentialsForm>;
export type SignupFormValues = z.infer<typeof SignupForm>;

export const ResetRequest = z.object({ email }).strict();
export type ResetRequestValues = z.infer<typeof ResetRequest>;

/**
 * `confirmPassword` never leaves the device — Supabase only ever sees
 * `password`. The refine lives here rather than inline in the screen so the
 * mismatch message stays next to the rest of the auth copy.
 */
export const NewPasswordForm = z
  .object({ password, confirmPassword: password })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type NewPasswordFormValues = z.infer<typeof NewPasswordForm>;
