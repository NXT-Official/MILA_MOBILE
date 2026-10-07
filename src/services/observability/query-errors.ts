import { ApiError } from "@/services/api/errors";

import { captureError } from "./index";

/**
 * Outcomes the product handles on purpose (paywall, rate limit, sign-in,
 * offline, bad input). They are not defects, so they stay out of Sentry.
 */
const EXPECTED_CODES: ReadonlySet<string> = new Set([
  "INSUFFICIENT_CREDITS",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "ACCOUNT_SUSPENDED",
  "VALIDATION_FAILED",
  "NETWORK",
  "TIMEOUT",
]);

export type QueryErrorContext =
  | { kind: "query"; key: readonly unknown[] }
  | { kind: "mutation" };

/**
 * Reports a TanStack Query / mutation failure. Only the first key segment (the
 * feature area) is attached: later segments are ids.
 */
export function reportQueryError(error: unknown, context: QueryErrorContext): void {
  if (error instanceof ApiError && EXPECTED_CODES.has(error.code)) return;
  if (context.kind === "query") {
    const area = context.key[0];
    captureError(error, {
      source: "query",
      key: typeof area === "string" ? area : "unknown",
    });
    return;
  }
  captureError(error, { source: "mutation" });
}
