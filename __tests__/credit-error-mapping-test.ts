import {
  ApiError,
  formatRetryAfter,
  isInsufficientCredits,
  isRateLimited,
  isSuspended,
  NON_RETRYABLE_CODES,
  resolveApiFailure,
} from "@/services/api/errors";

const err = (code: string, status = 500, retryAfter?: number) =>
  new ApiError(code, `${code} message`, status, retryAfter);

/**
 * The eight §6 codes plus the two the client raises itself. This mapping is what
 * stands between a member and a dead end, so every branch is pinned.
 */
describe("resolveApiFailure — the eight server codes", () => {
  it("routes INSUFFICIENT_CREDITS to the paywall, never a toast", () => {
    const failure = resolveApiFailure(err("INSUFFICIENT_CREDITS", 402));
    expect(failure.kind).toBe("paywall");
  });

  it("routes RATE_LIMITED to a countdown and carries retryAfter through", () => {
    const failure = resolveApiFailure(err("RATE_LIMITED", 429, 180));
    expect(failure.kind).toBe("rate-limited");
    expect(failure.retryAfterSeconds).toBe(180);
    expect(failure.message).toBe("Mila needs a moment. Try again in 3 minutes.");
  });

  it("makes AI_UNAVAILABLE retryable with the calm copy", () => {
    const failure = resolveApiFailure(err("AI_UNAVAILABLE", 502));
    expect(failure.kind).toBe("retryable");
    expect(failure.message).toBe("Mila couldn't compose a look this time. Please try again.");
  });

  it("keeps the server's reason on UPSTREAM_UNAVAILABLE, since it names what refused", () => {
    const failure = resolveApiFailure(
      new ApiError("UPSTREAM_UNAVAILABLE", "We couldn't stop your billing just now.", 503),
    );
    expect(failure.kind).toBe("retryable");
    expect(failure.message).toBe("We couldn't stop your billing just now.");
  });

  it("falls back to generic copy when UPSTREAM_UNAVAILABLE carries no message", () => {
    const failure = resolveApiFailure(new ApiError("UPSTREAM_UNAVAILABLE", "", 503));
    expect(failure.message).toBe("Something went wrong on our side. Please try again.");
  });

  it("routes ACCOUNT_SUSPENDED to the suspended gate", () => {
    expect(resolveApiFailure(err("ACCOUNT_SUSPENDED", 403)).kind).toBe("suspended");
  });

  it("treats UNAUTHENTICATED as a real sign-out, the client having already refreshed", () => {
    expect(resolveApiFailure(err("UNAUTHENTICATED", 401)).kind).toBe("auth");
  });

  it("surfaces VALIDATION_FAILED inline, preferring the server's field message", () => {
    const failure = resolveApiFailure(new ApiError("VALIDATION_FAILED", "Vibe is required.", 400));
    expect(failure.kind).toBe("validation");
    expect(failure.message).toBe("Vibe is required.");
  });

  it("gives FORBIDDEN and INTERNAL a generic state rather than a blank screen", () => {
    expect(resolveApiFailure(err("FORBIDDEN", 403)).kind).toBe("fatal");
    expect(resolveApiFailure(err("INTERNAL", 500)).kind).toBe("fatal");
  });
});

describe("resolveApiFailure — client-raised codes", () => {
  it("separates a timeout from a dead connection", () => {
    expect(resolveApiFailure(err("TIMEOUT", 0)).message).toBe("That took longer than expected.");
    expect(resolveApiFailure(err("NETWORK", 0)).message).toBe(
      "Mila couldn't reach the studio. Check your connection.",
    );
  });

  it("never leaks a raw code to a member", () => {
    const codes = [
      "INSUFFICIENT_CREDITS",
      "RATE_LIMITED",
      "AI_UNAVAILABLE",
      "ACCOUNT_SUSPENDED",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "INTERNAL",
      "TIMEOUT",
      "NETWORK",
    ];
    for (const code of codes) {
      expect(resolveApiFailure(err(code)).message).not.toContain(code);
    }
  });

  it("lands an unknown future code in fatal rather than undefined", () => {
    const failure = resolveApiFailure(err("SOME_NEW_SERVER_CODE"));
    expect(failure.kind).toBe("fatal");
    expect(failure.message.length).toBeGreaterThan(0);
  });

  it("handles a non-ApiError throw", () => {
    expect(resolveApiFailure(new Error("boom")).kind).toBe("fatal");
    expect(resolveApiFailure(undefined).kind).toBe("fatal");
  });
});

describe("formatRetryAfter", () => {
  it("rounds up, so the member is never told to retry too early", () => {
    expect(formatRetryAfter(61)).toBe("Mila needs a moment. Try again in 2 minutes.");
    expect(formatRetryAfter(120)).toBe("Mila needs a moment. Try again in 2 minutes.");
  });

  it("uses the singular at exactly one minute", () => {
    expect(formatRetryAfter(60)).toBe("Mila needs a moment. Try again in 1 minute.");
  });

  it("counts seconds under a minute rather than rounding to 0 or 1 minute", () => {
    expect(formatRetryAfter(30)).toBe("Mila needs a moment. Try again in 30 seconds.");
    expect(formatRetryAfter(1)).toBe("Mila needs a moment. Try again in 1 second.");
  });

  it("degrades when the server omits retryAfter", () => {
    expect(formatRetryAfter(undefined)).toBe("Mila needs a moment. Try again shortly.");
    expect(formatRetryAfter(0)).toBe("Mila needs a moment. Try again shortly.");
  });
});

describe("credit error identity", () => {
  it("identifies the paywall trigger and nothing else", () => {
    expect(isInsufficientCredits(err("INSUFFICIENT_CREDITS"))).toBe(true);
    expect(isInsufficientCredits(err("RATE_LIMITED"))).toBe(false);
    expect(isInsufficientCredits(new Error("INSUFFICIENT_CREDITS"))).toBe(false);
    expect(isInsufficientCredits(null)).toBe(false);
  });

  it("identifies rate limiting and suspension", () => {
    expect(isRateLimited(err("RATE_LIMITED"))).toBe(true);
    expect(isSuspended(err("ACCOUNT_SUSPENDED"))).toBe(true);
    expect(isSuspended(err("FORBIDDEN"))).toBe(false);
  });

  it("never marks a credit-charging failure as auto-retryable", () => {
    expect(NON_RETRYABLE_CODES).toContain("INSUFFICIENT_CREDITS");
    expect(NON_RETRYABLE_CODES).toContain("RATE_LIMITED");
  });
});
