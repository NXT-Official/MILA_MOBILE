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
 * Price and interval formatting moved to `lib/subscription-plans.ts`, which is
 * the Appendix A copy target — they are pure functions shared with the web and
 * do not belong beside a React hook. Re-exported here because `PaywallSheet`
 * already reaches for them through this module.
 */
export { formatBillingInterval, formatPlanPrice } from "@/lib/subscription-plans";
