import { formatPrice } from "@/utils/format-price";
import { __testing, relativeTime } from "@/utils/relative-time";

/**
 * Both are Appendix A copies split per function from the web's `lib/utils.ts`,
 * and both lean on `Intl`, which in Hermes is backed by the platform's own
 * formatter — so the failure mode is a throw at render, not a wrong string.
 */
const NOW = Date.parse("2026-08-14T12:00:00.000Z");

describe("relativeTime", () => {
  it("reads the recent past in minutes and hours", () => {
    expect(relativeTime("2026-08-14T11:58:00.000Z", NOW)).toMatch(/2 minutes ago/);
    expect(relativeTime("2026-08-14T09:00:00.000Z", NOW)).toMatch(/3 hours ago/);
  });

  it("steps up through days, weeks, months and years", () => {
    expect(relativeTime("2026-08-12T12:00:00.000Z", NOW)).toMatch(/2 days ago/);
    expect(relativeTime("2026-08-01T12:00:00.000Z", NOW)).toMatch(/2 weeks ago/);
    expect(relativeTime("2026-06-14T12:00:00.000Z", NOW)).toMatch(/2 months ago/);
    expect(relativeTime("2024-08-14T12:00:00.000Z", NOW)).toMatch(/2 years ago/);
  });

  it("collapses anything under a minute rather than counting seconds", () => {
    expect(relativeTime("2026-08-14T11:59:30.000Z", NOW)).toMatch(/now/);
  });

  it("returns an empty string for an unparseable date instead of Invalid Date", () => {
    expect(relativeTime("not a date", NOW)).toBe("");
  });

  it("handles a future timestamp — clock skew is not a crash", () => {
    expect(relativeTime("2026-08-14T12:02:00.000Z", NOW)).toMatch(/in 2 minutes/);
  });
});

/**
 * The device path. **Hermes ships no `Intl.RelativeTimeFormat`** on a default
 * Expo Android build, and this went to a real device as a top-level
 * `new Intl.RelativeTimeFormat(...)` — which threw on import and took four
 * routes down with it (Feed, Concierge, Palettes, member profile).
 *
 * Node has the API, so the tests above pass on either implementation and prove
 * nothing about the phone. These remove it and assert the fallback.
 */
describe("relativeTime without Intl.RelativeTimeFormat (Hermes)", () => {
  const original = Intl.RelativeTimeFormat;

  beforeEach(() => {
    // @ts-expect-error — deleting a built-in to reproduce the Hermes runtime.
    delete Intl.RelativeTimeFormat;
    __testing.resetFormatterCache();
  });

  afterEach(() => {
    // `Intl.RelativeTimeFormat` is typed read-only, so restoring it goes
    // through defineProperty rather than assignment.
    Object.defineProperty(Intl, "RelativeTimeFormat", {
      value: original,
      configurable: true,
      writable: true,
    });
    __testing.resetFormatterCache();
  });

  it("does not throw when the module is used", () => {
    expect(() => relativeTime("2026-08-14T11:58:00.000Z", NOW)).not.toThrow();
  });

  it("still reads as plain English in the past", () => {
    expect(relativeTime("2026-08-14T11:58:00.000Z", NOW)).toBe("2 minutes ago");
    expect(relativeTime("2026-08-14T09:00:00.000Z", NOW)).toBe("3 hours ago");
    expect(relativeTime("2026-08-12T12:00:00.000Z", NOW)).toBe("2 days ago");
  });

  it("singularises a single unit", () => {
    expect(relativeTime("2026-08-14T11:00:00.000Z", NOW)).toBe("1 hour ago");
  });

  it("reads the future correctly", () => {
    expect(relativeTime("2026-08-14T12:02:00.000Z", NOW)).toBe("in 2 minutes");
  });

  it("collapses anything under a minute to 'now'", () => {
    expect(relativeTime("2026-08-14T11:59:30.000Z", NOW)).toBe("now");
  });

  it("still returns an empty string for an unparseable date", () => {
    expect(relativeTime("not a date", NOW)).toBe("");
  });
});

describe("formatPrice", () => {
  it("formats a whole-unit price", () => {
    expect(formatPrice(120, "USD")).toBe("$120");
  });

  it("drops fraction digits, as the web does", () => {
    // maximumFractionDigits: 0 — this one takes whole units, unlike
    // `formatPlanPrice`, which takes minor units. Two different inputs, and
    // confusing them renders a price 100× off.
    expect(formatPrice(120.4, "USD")).toBe("$120");
  });

  it("falls back rather than throwing on an unknown currency", () => {
    expect(formatPrice(120, "NOTACURRENCY")).toBe("NOTACURRENCY 120");
  });
});
