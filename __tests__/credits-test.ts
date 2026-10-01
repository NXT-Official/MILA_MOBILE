import { effectiveCredits, utcDay } from "@/lib/credits";
import { formatResetCountdown } from "@/lib/credits-countdown";

/**
 * The display rule the web applies before it renders a balance: `ai_credits`
 * only holds today's bucket once the day has been reset, so until then the live
 * plan's allowance is what the member is owed. These are the cases that decide
 * whether a member sees her plan's credits or a zero on the morning her plan
 * started.
 */
describe("effectiveCredits", () => {
  const today = "2026-10-02";

  it("substitutes the allowance until the reset lands", () => {
    expect(
      effectiveCredits({
        aiCredits: 0,
        purchasedCredits: 0,
        creditsResetAt: "2026-10-01",
        planAllowance: 30,
        today,
      }),
    ).toBe(30);
  });

  it("uses the bucket once the row says today", () => {
    expect(
      effectiveCredits({
        aiCredits: 12,
        purchasedCredits: 0,
        creditsResetAt: today,
        planAllowance: 30,
        today,
      }),
    ).toBe(12);
  });

  it("always counts purchased credits, reset or not", () => {
    expect(
      effectiveCredits({
        aiCredits: 0,
        purchasedCredits: 5,
        creditsResetAt: "2026-10-01",
        planAllowance: 30,
        today,
      }),
    ).toBe(35);
  });

  it("owes nothing without a live plan", () => {
    expect(
      effectiveCredits({
        aiCredits: 0,
        purchasedCredits: 5,
        creditsResetAt: "2026-10-01",
        planAllowance: null,
        today,
      }),
    ).toBe(5);
  });
});

describe("utcDay", () => {
  it("buckets by the UTC calendar date, like the credit RPCs", () => {
    expect(utcDay(new Date("2026-10-02T23:59:59.000Z"))).toBe("2026-10-02");
    expect(utcDay(new Date("2026-10-03T00:00:01.000Z"))).toBe("2026-10-03");
  });
});

describe("formatResetCountdown", () => {
  it("counts to the next UTC midnight", () => {
    expect(formatResetCountdown(new Date("2026-10-02T10:18:00.000Z"))).toBe("13h 42m");
  });

  it("rounds up, so a partial minute is never reported as zero", () => {
    expect(formatResetCountdown(new Date("2026-10-02T23:59:30.000Z"))).toBe("0h 1m");
  });

  it("is never negative on the boundary itself", () => {
    expect(formatResetCountdown(new Date("2026-10-02T23:59:59.999Z"))).toBe("0h 1m");
  });
});
