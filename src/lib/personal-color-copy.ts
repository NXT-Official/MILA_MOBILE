/**
 * What to do about a failed colour read. Pure — the screen owns the rendering.
 *
 * The endpoint answers failures as `{ success: false, error }` with server
 * vocabulary (`ANALYSIS_RATE_LIMITED`, …); §6 says a code never reaches the
 * member's eyes, so every branch returns copy instead. `paywall` is the one
 * that must never be a toast (§7) — the server's credit failure opens the
 * paywall sheet, and nothing else.
 *
 * An unknown code is a retryable failure, not a dead end: the manual "I know
 * my season" path stays one tap away on the screen that consumes this.
 */
export type PersonalColorFailure = {
  kind: "paywall" | "rate-limited" | "retry";
  message: string;
};

const RETRY_COPY =
  "The reading didn't come through. Keep the light soft and natural, then try again.";

export function resolvePersonalColorFailure(
  error: string | undefined | null,
): PersonalColorFailure {
  switch (error) {
    case "INSUFFICIENT_CREDITS":
    case "ANALYSIS_CREDITS_EXHAUSTED":
      return { kind: "paywall", message: "You're out of credits" };
    case "ANALYSIS_RATE_LIMITED":
      return {
        kind: "rate-limited",
        message: "You've reached the hourly limit for studio readings. Try again in a little while.",
      };
    default:
      return { kind: "retry", message: RETRY_COPY };
  }
}
