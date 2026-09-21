import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useProfile } from "@/hooks/use-profile";
import { outfitsKey } from "@/hooks/use-outfits";
import { computeMakeupEligibility } from "@/lib/makeup-eligibility";
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
 *
 * The web's save is a server function, and it reads the eligibility snapshot
 * (`gender`, `makeup_preference`, `hair_length`, `photo_consent_at`) from the
 * profile row server-side. This one is on the client, so the hook reads the
 * same four values from the profile query — the one the look was composed
 * against, refetched on every foreground — and writes the same snapshot.
 */
export function useSaveLook() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const { data: profile } = useProfile();
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
        forecastRetrievedAt: input.forecastRetrievedAt ?? null,
        // The picks the member was shown, by id — history re-hydrates them from
        // the catalogue rather than re-reading model text.
        productIds: (input.shoppable_picks ?? []).map((pick) => pick.id),
        previewMode: input.previewMode,
        gender: profile?.gender ?? null,
        makeupEnabled: computeMakeupEligibility({
          gender: profile?.gender,
          makeup_preference: profile?.makeup_preference,
        }),
        hairLength: profile?.hair_length ?? null,
        photoConsentVersion: profile?.photo_consent_at ?? null,
      });
    },
    onSuccess: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: outfitsKey(userId) });
    },
  });
}
