import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import type { DailyPalette } from "@/lib/color-analysis/paletteGenerator";
import { deleteSavedPalette, fetchSavedPalettes, savePalette } from "@/services/supabase/palettes";
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

/**
 * Pinning a palette. Idempotent server-side — `savePalette` swallows the unique
 * violation — so a double tap is a save, not an error the member has to read.
 */
export function useSavePalette() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<void, unknown, DailyPalette>({
    mutationFn: (palette) => {
      if (!userId) throw new Error("Not signed in.");
      return savePalette(userId, palette);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.savedPalettes(userId ?? undefined),
      }),
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
