/**
 * The web project's `src/constants/password.ts` is the source (Appendix A):
 * five checks, and both clients gate every password flow on all of them —
 * sign-up, reset, and change. The web's submit buttons test
 * `passwordChecks.every(...)`; a rule that only one client shows is two
 * different passwords' worth of guidance.
 *
 * `PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH` are the form-layer schema bounds
 * (`lib/auth-input.ts`), mirroring the web server's own zod bounds (8–128).
 * The checklist is deliberately stricter, exactly as the web's is.
 */
export const passwordChecks = [
  { label: "At least 12 characters", test: (p: string) => p.length >= 12 },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One digit", test: (p: string) => /[0-9]/.test(p) },
  { label: "One symbol", test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

/** One rule per check; the label doubles as the checklist's list key. */
export const PASSWORD_RULES: PasswordRule[] = passwordChecks.map((check) => ({
  id: check.label,
  label: check.label,
  test: check.test,
}));

export function passwordRuleResults(value: string) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(value) }));
}
