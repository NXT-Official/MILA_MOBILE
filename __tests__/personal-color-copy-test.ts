import { resolvePersonalColorFailure } from "@/lib/personal-color-copy";

/**
 * The colour read's failure mapping. §6 says a server code never reaches the
 * member's eyes, and §7 says the credit failure opens the paywall — both are
 * pinned here, because this module is the only thing standing between the two.
 */
describe("resolvePersonalColorFailure", () => {
  it("routes both credit failures to the paywall", () => {
    expect(resolvePersonalColorFailure("INSUFFICIENT_CREDITS").kind).toBe("paywall");
    expect(resolvePersonalColorFailure("ANALYSIS_CREDITS_EXHAUSTED").kind).toBe("paywall");
  });

  it("names the rate limit without leaking the server code", () => {
    const failure = resolvePersonalColorFailure("ANALYSIS_RATE_LIMITED");
    expect(failure.kind).toBe("rate-limited");
    expect(failure.message).not.toContain("ANALYSIS_");
  });

  it("makes gateway, parsing, and config failures retryable", () => {
    for (const code of [
      "ANALYSIS_PARSING_FAILED",
      "ANALYSIS_GATEWAY_FAILURE",
      "CONFIG_MISSING_API_KEY",
      "SERVER_GATEWAY_TIMEOUT",
    ]) {
      expect(resolvePersonalColorFailure(code).kind).toBe("retry");
    }
  });

  it("lands an unknown or missing code in retry rather than a dead end", () => {
    expect(resolvePersonalColorFailure("SOME_FUTURE_CODE").kind).toBe("retry");
    expect(resolvePersonalColorFailure(undefined).kind).toBe("retry");
    expect(resolvePersonalColorFailure(null).kind).toBe("retry");
  });

  it("never shows the member a raw failure code", () => {
    const codes = [
      "INSUFFICIENT_CREDITS",
      "ANALYSIS_CREDITS_EXHAUSTED",
      "ANALYSIS_RATE_LIMITED",
      "ANALYSIS_PARSING_FAILED",
      "ANALYSIS_GATEWAY_FAILURE",
    ];
    for (const code of codes) {
      expect(resolvePersonalColorFailure(code).message).not.toContain(code);
    }
  });
});
