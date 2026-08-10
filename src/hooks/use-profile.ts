import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import {
  fetchProfile,
  updateStyleProfile,
  type StyleProfileUpdate,
} from "@/services/supabase/profile";
import { useAuthStore } from "@/stores/auth-store";

/**
 * The single owner of `queryKeys.profile(userId)`. The launch gate, onboarding,
 * and every later surface read through here — two queries on one key is how a
 * screen reads a shape the cache does not hold.
 */
export function useProfile() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: queryKeys.profile(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: () => fetchProfile(userId as string),
  });
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
