/**
 * The only four values that ship in the binary, all public by design.
 *
 * EXPO_PUBLIC_* values are compiled into the JavaScript bundle and are
 * trivially extractable from a shipped APK. Adding anything here requires a
 * line in the architecture doc's §10 secrets table, and `npm run scan:secrets`
 * fails the build if a non-EXPO_PUBLIC_ secret name reaches the bundle.
 *
 * Metro inlines process.env.EXPO_PUBLIC_* at build time, so each one must be
 * referenced by its full literal name — a computed lookup resolves to
 * undefined.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    // Fail at boot with the variable name rather than at the first request with
    // an opaque network error.
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in, or set it in the EAS build profile.`,
    );
  }
  return value;
}

export const env = {
  SUPABASE_URL: required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  SUPABASE_PUBLISHABLE_KEY: required(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  API_BASE_URL: required("EXPO_PUBLIC_API_BASE_URL", process.env.EXPO_PUBLIC_API_BASE_URL),
  HCAPTCHA_SITEKEY: required(
    "EXPO_PUBLIC_HCAPTCHA_SITEKEY",
    process.env.EXPO_PUBLIC_HCAPTCHA_SITEKEY,
  ),
} as const;
