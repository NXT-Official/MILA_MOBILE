import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import {
  fetchProfile,
  updateStyleProfile,
  type StyleProfileUpdate,
} from "@/services/supabase/profile";
import { useAuthStore } from "@/stores/auth-store";

import { useAppState } from "./use-app-state";

/**
 * The single owner of `queryKeys.profile(userId)`. The launch gate, onboarding,
 * and every later surface read through here — two queries on one key is how a
 * screen reads a shape the cache does not hold.
 */
export function useProfile() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.profile(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    // The query's signal lets a cancelled or superseded read stop at once;
    // fetchProfile adds its own deadline so a stalled one fails and retries.
    queryFn: ({ signal }) => fetchProfile(userId as string, signal),
  });

  // Foreground refetch (§6). `refetchOnWindowFocus` is off in the client
  // because a phone has no window focus; this is its replacement. Suspension is
  // read from this row, so a stale profile is also a stale suspension check.
  useAppState(() => {
    if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
  });

  return query;
}

/**
 * Writes one onboarding answer. Invalidates the profile key **explicitly** —
 * never a bare `invalidateQueries()` — and never auto-retries, per the client
 * default: a retried write is not a double charge here, but the rule is uniform
 * so no mutation has to be audited for whether it happens to be safe.
 */
export function useUpdateStyleProfile() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: StyleProfileUpdate) => {
      if (!userId) throw new Error("Not signed in.");
      await updateStyleProfile(userId, payload);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId ?? undefined) }),
  });
}
