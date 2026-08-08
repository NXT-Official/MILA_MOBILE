import { env } from "@/constants/env";

/**
 * hCaptcha configuration. The widget itself is `components/CaptchaGate`, which
 * wraps `@hcaptcha/react-native-hcaptcha` — a WebView-backed challenge.
 *
 * The sitekey is public by design (§10). The *secret* verifies tokens and lives
 * only on the server; Supabase Auth holds it and rejects a tokenless or forged
 * request with `captcha_failed`.
 */
export const CAPTCHA_SITEKEY = env.HCAPTCHA_SITEKEY;

/**
 * hCaptcha refuses to run on `localhost` and shows "localhost detected" instead
 * of a challenge. The WebView needs a real https origin that matches the
 * sitekey's allowed hostnames.
 */
export const CAPTCHA_BASE_URL = "https://mila.app";

/** A token is single-use and short-lived. Reset after every attempt. */
export type CaptchaResult =
  | { status: "token"; token: string }
  | { status: "cancelled" }
  | { status: "expired" }
  | { status: "error"; message: string };
