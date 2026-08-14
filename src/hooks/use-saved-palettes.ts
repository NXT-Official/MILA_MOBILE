import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { deleteSavedPalette, fetchSavedPalettes } from "@/services/supabase/palettes";
import { useAuthStore } from "@/stores/auth-store";

/** 60s stale (§6) — refetched after a save or a delete, not on a timer. */
export function useSavedPalettes() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: queryKeys.savedPalettes(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: () => fetchSavedPalettes(userId as string),
  });
}

export function useDeleteSavedPalette() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<void, unknown, string>({
    mutationFn: (id) => {
      if (!userId) throw new Error("Not signed in.");
      return deleteSavedPalette(userId, id);
    },
    // Explicit key, never a bare invalidateQueries(). The Studio strip and the
    // full list read the same key, so both update from this one call.
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.savedPalettes(userId ?? undefined),
      }),
  });
}
