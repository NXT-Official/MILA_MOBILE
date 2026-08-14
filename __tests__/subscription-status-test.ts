import { IN_FORCE_SUBSCRIPTION_STATUSES } from "@/constants/subscriptions";
import { formatPlanPrice, normalizePlanFeatures } from "@/lib/subscription-plans";
import { formatPeriodDate, resolveMembership } from "@/lib/subscription-status";

const PERIOD_END = "2026-09-01T00:00:00.000Z";

function row(overrides: Partial<Parameters<typeof resolveMembership>[0]> = {}) {
  return {
    status: "active",
    cancel_at_period_end: false,
    current_period_end: PERIOD_END,
    ...overrides,
  };
}

describe("resolveMembership", () => {
  it("reads an active subscription as renewing", () => {
    expect(resolveMembership(row())).toEqual({
      inForce: true,
      headline: "renews",
      date: PERIOD_END,
      status: "active",
      paymentFailing: false,
    });
  });

  it("treats trialing as in force", () => {
    expect(resolveMembership(row({ status: "trialing" })).inForce).toBe(true);
  });

  /**
   * The rule the phase doc calls out by name: a failed renewal enters dunning
   * and Paddle retries for days. Locking a member out at the first decline
   * takes away access she has paid for.
   */
  it("keeps past_due in force rather than locking a paying member out", () => {
    const state = resolveMembership(row({ status: "past_due" }));
    expect(state.inForce).toBe(true);
    expect(state.headline).toBe("renews");
    expect(state.paymentFailing).toBe(true);
  });

  it("only flags payment trouble for past_due", () => {
    expect(resolveMembership(row({ status: "active" })).paymentFailing).toBe(false);
    expect(resolveMembership(row({ status: "trialing" })).paymentFailing).toBe(false);
  });

  /**
   * Getting this backwards tells a member who cancelled that she will be
   * charged again, or tells a paying member her access is about to stop.
   */
  it("switches renews to ends when cancellation is scheduled", () => {
    const state = resolveMembership(row({ cancel_at_period_end: true }));
    expect(state.headline).toBe("ends");
    // Still in force — cancelling is not losing access today.
    expect(state.inForce).toBe(true);
    expect(state.date).toBe(PERIOD_END);
  });

  it("reads a status outside the in-force set as lapsed", () => {
    const state = resolveMembership(row({ status: "canceled" }));
    expect(state.inForce).toBe(false);
    expect(state.headline).toBe("lapsed");
    expect(state.date).toBe(PERIOD_END);
  });

  it("does not invent a payment problem on a lapsed row", () => {
    expect(resolveMembership(row({ status: "paused" })).paymentFailing).toBe(false);
  });

  it("reads no row as no membership", () => {
    expect(resolveMembership(null).headline).toBe("none");
    expect(resolveMembership(undefined).inForce).toBe(false);
  });

  it("handles an in-force row with no period end", () => {
    const state = resolveMembership(row({ current_period_end: null }));
    expect(state.headline).toBe("renews");
    expect(state.date).toBeNull();
  });
});

describe("IN_FORCE_SUBSCRIPTION_STATUSES", () => {
  it("is the web's list, verbatim", () => {
    expect(IN_FORCE_SUBSCRIPTION_STATUSES).toEqual(["active", "trialing", "past_due"]);
  });
});

describe("formatPeriodDate", () => {
  it("returns a readable date, never a raw ISO string", () => {
    expect(formatPeriodDate(PERIOD_END)).not.toContain("T00:00");
    expect(formatPeriodDate(PERIOD_END)).toMatch(/2026/);
  });

  it("degrades rather than rendering Invalid Date", () => {
    expect(formatPeriodDate("not a date")).toBeNull();
    expect(formatPeriodDate(null)).toBeNull();
  });
});

describe("formatPlanPrice", () => {
  it("reads a two-decimal currency from minor units", () => {
    expect(formatPlanPrice(999, "usd")).toBe("$9.99");
  });

  /**
   * The divergence from the web recorded in `lib/subscription-plans.ts`: JPY has
   * no minor unit, so dividing by 100 renders a price two orders of magnitude
   * too small — on a paywall, the worst possible rounding error.
   */
  it("does not divide a zero-decimal currency", () => {
    expect(formatPlanPrice(1000, "jpy")).toContain("1,000");
    expect(formatPlanPrice(1000, "jpy")).not.toContain("10.00");
  });

  it("falls back to a plain string rather than crashing the screen", () => {
    expect(formatPlanPrice(999, "not-a-currency")).toBe("NOT-A-CURRENCY 9.99");
  });
});

describe("normalizePlanFeatures", () => {
  it("keeps trimmed strings and drops everything else", () => {
    expect(normalizePlanFeatures(["  Daily looks ", "", 42, null, "Lens"])).toEqual([
      "Daily looks",
      "Lens",
    ]);
  });

  it("returns nothing for a malformed JSONB column", () => {
    expect(normalizePlanFeatures(null)).toEqual([]);
    expect(normalizePlanFeatures("Daily looks")).toEqual([]);
  });
});
