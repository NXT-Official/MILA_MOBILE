import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import {
  fetchProfileExtras,
  saveProfileExtras,
  type ProfileExtras,
  type ProfileExtrasUpdate,
} from "@/services/supabase/profile-extras";
import { useAuthStore } from "@/stores/auth-store";

export type ProfileExtrasState = {
  /** True while the first read is in flight. */
  loading: boolean;
  /** False while the Wave D migration is missing: every dependent surface hides. */
  available: boolean;
  extras: ProfileExtras | null;
};

/**
 * Her hair colour and last check-in, from the guarded Wave D read. Kept off
 * `queryKeys.profile` on purpose: a missing column must never break that read.
 */
export function useProfileExtras(): ProfileExtrasState {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  const query = useQuery({
    queryKey: queryKeys.profileExtras(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: () => fetchProfileExtras(userId as string),
  });

  const data = query.data;
  return {
    loading: query.isPending && Boolean(userId),
    available: data?.status === "ok",
    extras: data?.status === "ok" ? data.extras : null,
  };
}

/** Never auto-retries (the client default); refreshes the extras key explicitly. */
export function useSaveProfileExtras() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProfileExtrasUpdate) => {
      if (!userId) throw new Error("Not signed in.");
      return saveProfileExtras(userId, payload);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.profileExtras(userId ?? undefined) }),
  });
}
