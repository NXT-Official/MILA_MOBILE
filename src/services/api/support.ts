import { api, TIMEOUTS } from "./client";

/**
 * `POST /support/message` — the one **unauthenticated** route in the app.
 *
 * That is why it takes a captcha token: with no session to rate-limit against,
 * hCaptcha plus a 3-per-15-minutes IP limit are the whole defence. Both are
 * verified server-side; the token here is single-use and short-lived.
 */
export type SupportKind = "help" | "feedback";

export type SupportInput = {
  kind: SupportKind;
  /** Capped at 2000 server-side; the form enforces it at the keyboard. */
  message: string;
  captchaToken: string;
};

export const MAX_SUPPORT_MESSAGE_LENGTH = 2000;

export function sendSupportMessage(input: SupportInput): Promise<{ ok: true }> {
  return api.post<{ ok: true }>("/support/message", input, { timeoutMs: TIMEOUTS.default });
}
