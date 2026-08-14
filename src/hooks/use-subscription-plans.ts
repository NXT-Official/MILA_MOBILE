import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { fetchSubscriptionPlans } from "@/services/supabase/plans";

/** Shared by `/membership` and `PaywallSheet` — one key, one fetch, one order. */
export function useSubscriptionPlans() {
  return useQuery({
    queryKey: queryKeys.subscriptionPlans,
    staleTime: 60_000,
    queryFn: fetchSubscriptionPlans,
  });
}

/**
 * `price_amount` is in minor units (§7 of the web reference). Dividing by a
 * fixed 100 is wrong for zero-decimal currencies, so the currency drives the
 * fraction digits rather than a hardcoded divisor.
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

export function formatBillingInterval(interval: string): string {
  if (interval === "monthly") return "per month";
  if (interval === "yearly") return "per year";
  return "one-time";
}
