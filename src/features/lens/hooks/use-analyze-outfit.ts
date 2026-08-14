import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { queryKeys } from "@/constants/query-keys";
import { outfitsKey } from "@/hooks/use-outfits";
import { useProfile } from "@/hooks/use-profile";
import { analyzeOutfit } from "@/services/api/analysis";
import type { CapturedPhoto } from "@/services/camera";
import { saveLensAnalysis } from "@/services/supabase/outfits";
import { uploadOutfitImage } from "@/services/supabase/storage";
import { useAuthStore } from "@/stores/auth-store";
import type { LensAnalysisRecord } from "@/types/look";

export type LensResult = { analysis: LensAnalysisRecord; outfitId: string };

/**
 * Upload → analyse → record, as one mutation.
 *
 * The order is not an implementation detail. `imageUrl` must already be a Mila
 * storage URL when `/analysis/outfit` sees it, because the server rejects
 * anything else — handing a server-side fetch a client-supplied URL is a
 * server-side request forgery primitive (§8).
 *
 * No retry: `/analysis/outfit` charges a credit, and a retried credit-charging
 * call is a double charge. The query client's `mutations: { retry: false }`
 * default already covers this and is not restated.
 */
export function useAnalyzeOutfit() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  /**
   * A retry after a failed *analysis* must not re-upload a capture that already
   * reached storage: it is the same unchanged file, and on cellular data it is
   * the most expensive part of the whole flow. Keyed by the local URI, so a
   * retake uploads properly rather than analysing the previous frame.
   */
  const uploaded = useRef<{ localUri: string; imageUrl: string } | null>(null);

  return useMutation<LensResult, unknown, CapturedPhoto>({
    mutationFn: async (photo) => {
      if (!userId) throw new Error("Not signed in.");

      // The sub-season is the more precise input and is what the web sends; the
      // base family is the fallback for a legacy row whose analysis only ever
      // wrote the column.
      const colorSeason = profile?.color_season ?? profile?.color_season_base;
      if (!profile?.body_type || !colorSeason) {
        // Unreachable through the UI — the capture screen blocks on an
        // incomplete profile — but the API requires both, and a 400 here would
        // surface as an unexplained validation error rather than the real cause.
        throw new Error("Style Profile is incomplete.");
      }

      const imageUrl =
        uploaded.current?.localUri === photo.uri
          ? uploaded.current.imageUrl
          : await uploadOutfitImage(userId, photo.uri);
      uploaded.current = { localUri: photo.uri, imageUrl };

      const analysis = await analyzeOutfit({
        imageUrl,
        bodyType: profile.body_type,
        colorSeason,
      });

      // Direct insert, per §7's direct-vs-API rule: the credit was already
      // metered by the call above, and this row needs no secret and no
      // permission RLS cannot express.
      const outfit = await saveLensAnalysis(userId, { imageUrl, analysis });
      return { analysis, outfitId: outfit.id };
    },

    /**
     * On settle, not on success. A failed analysis may still have moved the
     * ledger — the server charges before the provider call and refunds on a
     * throw — so the balance is re-read either way.
     *
     * Declared here rather than in a `mutate()` callback so it still runs if
     * the member leaves mid-analysis. A paid call is never silently discarded.
     */
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
      void queryClient.invalidateQueries({ queryKey: outfitsKey(userId) });
    },
  });
}
