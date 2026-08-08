/**
 * HAND-WRITTEN from the architecture doc §6 (password 8–128). The web project's
 * `src/constants/password.ts` is the real source and should be copied over this
 * file (Appendix A) so the two clients show identical strength guidance.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH,
  },
  { id: "lower", label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { id: "upper", label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "number", label: "A number", test: (v) => /\d/.test(v) },
];

export function passwordRuleResults(value: string) {
  return PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(value) }));
}
