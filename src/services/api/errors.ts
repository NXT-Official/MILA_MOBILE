/**
 * The §6 error taxonomy, in a module that imports nothing.
 *
 * Deliberately leaf: `client.ts` pulls in the Supabase client and therefore
 * `env`, which throws when the four `EXPO_PUBLIC_*` values are absent. Keeping
 * the codes and their member-facing meaning here is what lets the mapping be
 * unit-tested — and this mapping decides whether a member sees the paywall or a
 * dead end, so it is the last thing that should be untested.
 */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The single most important code in the app — the paywall trigger and the
 * primary conversion moment. Mapped explicitly; it never falls into the generic
 * handler.
 */
export const isInsufficientCredits = (e: unknown) =>
  e instanceof ApiError && e.code === "INSUFFICIENT_CREDITS";

export const isRateLimited = (e: unknown) => e instanceof ApiError && e.code === "RATE_LIMITED";

export const isSuspended = (e: unknown) => e instanceof ApiError && e.code === "ACCOUNT_SUSPENDED";

/** Retrying any of these is always wrong. */
export const NON_RETRYABLE_CODES = [
  "INSUFFICIENT_CREDITS",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "ACCOUNT_SUSPENDED",
  "VALIDATION_FAILED",
] as const;

/**
 * What the UI should *do*, not what went wrong. Screens switch on `kind` so a
 * new server code cannot silently become a blank screen — it lands in `fatal`
 * with usable copy.
 */
export type FailureKind =
  | "paywall" // open PaywallSheet — never a toast
  | "rate-limited" // disable the action until `retryAfterSeconds` elapses
  | "retryable" // show the copy with a retry affordance
  | "suspended" // route to /suspended
  | "auth" // session is gone; the gate signs out
  | "validation" // inline field error
  | "fatal"; // generic error state, report to crash logging

export type ApiFailure = {
  kind: FailureKind;
  /** Plain language. **Never a raw error code** — a member cannot act on one. */
  message: string;
  retryAfterSeconds?: number;
};

const GENERIC = "Something went wrong on our side. Please try again.";

/**
 * `retryAfter` is seconds. Rounded **up**, because telling someone to try again
 * in 0 minutes — or in 1 when 90 seconds remain — produces a second rejection
 * and reads as the app lying.
 */
export function formatRetryAfter(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "Mila needs a moment. Try again shortly.";
  if (seconds < 60) {
    return `Mila needs a moment. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `Mila needs a moment. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function resolveApiFailure(error: unknown): ApiFailure {
  if (!(error instanceof ApiError)) {
    return { kind: "fatal", message: GENERIC };
  }

  switch (error.code) {
    case "INSUFFICIENT_CREDITS":
      return { kind: "paywall", message: "You're out of credits for today." };

    case "RATE_LIMITED":
      return {
        kind: "rate-limited",
        message: formatRetryAfter(error.retryAfter),
        retryAfterSeconds: error.retryAfter,
      };

    case "AI_UNAVAILABLE":
      return {
        kind: "retryable",
        message: "Mila couldn't compose a look this time. Please try again.",
      };

    // Something the server depends on refused — a provider, Paddle, the
    // captcha verifier. The server's own message is preferred because it is the
    // only thing that says *what* refused: after a failed account deletion,
    // "we couldn't stop your billing, so nothing was deleted" is the difference
    // between a member who knows her account still exists and one who doesn't.
    case "UPSTREAM_UNAVAILABLE":
      return { kind: "retryable", message: error.message || GENERIC };

    case "TIMEOUT":
      return { kind: "retryable", message: "That took longer than expected." };

    case "NETWORK":
      return {
        kind: "retryable",
        message: "Mila couldn't reach the studio. Check your connection.",
      };

    case "ACCOUNT_SUSPENDED":
      return { kind: "suspended", message: "This account is suspended." };

    case "UNAUTHENTICATED":
      // The client already refreshed once and failed, so this is a real
      // sign-out, not a transient blip.
      return { kind: "auth", message: "Please sign in again." };

    case "VALIDATION_FAILED":
      return { kind: "validation", message: error.message || "Please check the details and retry." };

    case "FORBIDDEN":
      return { kind: "fatal", message: "That isn't available on this account." };

    case "INTERNAL":
    default:
      return { kind: "fatal", message: GENERIC };
  }
}
