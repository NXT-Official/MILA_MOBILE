import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { fetchEntitlements } from "@/services/supabase/entitlements";
import { useAuthStore } from "@/stores/auth-store";

import { useAppState } from "./use-app-state";

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
    queryFn: () => fetchEntitlements(userId as string),
  });

  // Explicit key, never a bare invalidateQueries().
  useAppState(() => {
    if (userId) void queryClient.invalidateQueries({ queryKey: key });
  });

  return query;
}

/**
 * `ai_credits + purchased_credits` — the §7 display rule, in one place.
 *
 * This is a rendering of two server columns, not a computation: it never
 * predicts the reset, never decrements on spend, and nothing branches on it.
 * The server's `INSUFFICIENT_CREDITS` is the only authority on affordability.
 */
export function useCreditBalance(): number | null {
  const { data } = useCredits();
  return data ? data.ai_credits + data.purchased_credits : null;
}
