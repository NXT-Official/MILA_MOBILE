import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { fetchMySubscription } from "@/services/supabase/subscriptions";
import { useAuthStore } from "@/stores/auth-store";

import { useAppState } from "./use-app-state";

/**
 * The member's subscription, straight from the row the webhook wrote.
 *
 * `staleTime: 0` (§6) for the same reason credits use it: this changes
 * server-side without the app knowing. A renewal lands, a card fails and
 * dunning starts, a cancellation takes effect at period end — none of it
 * involves the device, so any cached answer is a guess.
 */
export function useMySubscription() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const key = queryKeys.mySubscription(userId ?? undefined);

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(userId),
    staleTime: 0,
    queryFn: () => fetchMySubscription(userId as string),
  });

  // Foreground refetch — the replacement for `refetchOnWindowFocus`, which a
  // phone has no equivalent of. This is also what catches a webhook that landed
  // while she was away paying in the browser.
  useAppState(() => {
    if (userId) void queryClient.invalidateQueries({ queryKey: key });
  });

  return query;
}
