/**
 * Copied from the web project's `src/lib/subscription-plans.ts` (Appendix A),
 * with **two deliberate deviations**, both recorded here rather than discovered
 * later during a re-copy.
 *
 * **1. The admin half is omitted.** The web file also carries
 * `createPlanInputSchema`, `updatePlanInputSchema`, `catalogFormShape`,
 * `planSlugSchema`, `slugifyPlanTitle`, and `parsePriceToCents` — all of which
 * exist to serve the plan editor in the staff catalogue. AGENTS §2 is absolute
 * that admin surfaces must not exist in this codebase "not behind a flag, not
 * for later", and a Zod schema for creating a plan is the first half of one.
 * Appendix A already sets this precedent: `query-keys.ts` is copied "minus the
 * five `admin*` keys".
 *
 * **2. `formatPlanPrice` diverges, and the web is the one that is wrong.** The
 * web divides `price_amount` by 100 unconditionally. Paddle stores amounts in
 * the currency's smallest unit, and JPY, KRW and CLP have no minor unit at all
 * — so ¥1000 is stored as `1000` and the web renders it as ¥10.00. The version
 * below reads the fraction digits from the currency instead. This should be
 * fixed on the web and re-converged; until then the two clients differ only for
 * zero-decimal currencies, and only one of them is correct.
 */

export const BILLING_INTERVALS = ["monthly", "yearly", "one_time"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  one_time: "One-time",
};

export const BILLING_INTERVAL_SUFFIX: Record<BillingInterval, string> = {
  monthly: "/ month",
  yearly: "/ year",
  one_time: "one-time",
};

/** The columns a member may read. `paddle_price_id` is not among them — see below. */
export const PUBLIC_PLAN_COLUMNS =
  "id,slug,title,description,price_amount,currency,billing_interval,credits_included,features,is_featured";

/** `features` is a JSONB column, so a malformed row must degrade rather than throw. */
export function normalizePlanFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is string => typeof f === "string")
    .map((f) => f.trim())
    .filter(Boolean);
}

export function centsToPriceInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/**
 * Currencies with no minor unit. Dividing these by 100 renders a price two
 * orders of magnitude too small, which on a paywall is the worst possible
 * rounding error.
 */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "CLP", "VND", "ISK"]);

export function formatPlanPrice(amountMinor: number, currency: string): string {
  const code = currency.toUpperCase();
  const digits = ZERO_DECIMAL.has(code) ? 0 : 2;
  const amount = digits === 0 ? amountMinor : amountMinor / 100;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    // Hermes' Intl is backed by the platform's own formatter, so an unusual
    // currency code or a locale-data gap throws rather than degrading. A plain
    // "USD 9.99" is a worse price tag than "$9.99" and a much better one than
    // a membership screen that crashes on render.
    return `${code} ${amount.toFixed(digits)}`;
  }
}

/** Reads under a price, so it is a phrase rather than the web's terse suffix. */
export function formatBillingInterval(interval: string): string {
  if (interval === "monthly") return "per month";
  if (interval === "yearly") return "per year";
  return "one-time";
}
