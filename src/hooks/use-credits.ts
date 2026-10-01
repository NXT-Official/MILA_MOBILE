import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { isSubscriptionLive } from "@/constants/subscriptions";
import { effectiveCredits, utcDay } from "@/lib/credits";
import { fetchEntitlements } from "@/services/supabase/entitlements";
import { fetchPlanAllowance } from "@/services/supabase/plans";
import { fetchMySubscription } from "@/services/supabase/subscriptions";
import { useAuthStore } from "@/stores/auth-store";

import { useAppState } from "./use-app-state";

/**
 * What the member can spend today, as the server's own rules define it.
 *
 * `ai_credits` only holds today's bucket once the day has been reset, so a
 * member whose plan started this morning would otherwise read zero until her
 * first spend. `effectiveCredits` substitutes the live plan's allowance until
 * the reset lands — the web's rule, copied (lib/credits.ts) — and the meter
 * needs the allowance and the reset date beside the total to explain itself.
 */
export type CreditState = {
  /** The displayed balance: daily bucket (or owed allowance) + purchased. */
  balance: number;
  /** The live plan's daily allowance, or null when no plan owes one. */
  allowance: number | null;
  /** UTC date of the last daily reset; null until the first one. */
  creditsResetAt: string | null;
};

/**
 * The displayed balance and nothing more.
 *
 * `staleTime: 0` (§6) because credits change server-side without the app
 * knowing — a purchase completes in the browser, the daily bucket resets, a
 * generation lands. Any cached answer is a guess, so every read goes back to
 * the row.
 */
export function useCredits() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const key = queryKeys.credits(userId ?? undefined);

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(userId),
    staleTime: 0,
    queryFn: async (): Promise<CreditState> => {
      const [entitlement, subscription] = await Promise.all([
        fetchEntitlements(userId as string),
        fetchMySubscription(userId as string),
      ]);

      // The allowance is only owed while the subscription is live — a lapsed
      // plan promises nothing, which is also why effectiveCredits falls back
      // to 0 for it.
      const live = subscription && isSubscriptionLive(subscription) ? subscription : null;
      const allowance = live ? await fetchPlanAllowance(live.plan_id) : null;

      return {
        balance: effectiveCredits({
          aiCredits: entitlement.ai_credits,
          purchasedCredits: entitlement.purchased_credits,
          creditsResetAt: entitlement.credits_reset_at,
          planAllowance: allowance,
          today: utcDay(),
        }),
        allowance,
        creditsResetAt: entitlement.credits_reset_at,
      };
    },
  });

  // Explicit key, never a bare invalidateQueries().
  useAppState(() => {
    if (userId) void queryClient.invalidateQueries({ queryKey: key });
  });

  return query;
}

/**
 * The displayed balance, in one place.
 *
 * This is a rendering of the server's columns under the server's rule, not a
 * computation of its own: it never predicts the reset, never decrements on
 * spend, and nothing branches on it. The server's `INSUFFICIENT_CREDITS` is the
 * only authority on affordability.
 */
export function useCreditBalance(): number | null {
  const { data } = useCredits();
  return data ? data.balance : null;
}
