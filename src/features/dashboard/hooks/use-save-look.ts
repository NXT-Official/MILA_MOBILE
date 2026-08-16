import { useMutation, useQueryClient } from "@tanstack/react-query";

import { outfitsKey } from "@/hooks/use-outfits";
import type { SaveLookInput } from "@/services/api/look";
import { saveDailyLook, type OutfitRow } from "@/services/supabase/outfits";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Saving a look is **direct through RLS**, not an API call.
 *
 * It used to be `POST /look/save`. The Phase 11 audit found that endpoint needs
 * no secret, no credit, and no admin — the web's own implementation runs
 * entirely on the caller's client — so §7's direct-vs-API rule puts it here.
 * Nothing is charged, which is why only the history list is invalidated, and
 * explicitly by key.
 */
export function useSaveLook() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<OutfitRow, unknown, SaveLookInput>({
    mutationFn: (input) => {
      if (!userId) throw new Error("Not signed in.");
      return saveDailyLook(userId, {
        imageDataUri: input.imageDataUri,
        weather: input.weather,
        vibe: input.vibe,
        outfit: input.outfit,
        hair: input.hair,
        makeup: input.makeup,
        vibe_alignment_score: input.vibe_alignment_score,
      });
    },
    onSuccess: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: outfitsKey(userId) });
    },
  });
}
