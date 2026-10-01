import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { queryKeys } from "@/constants/query-keys";
import { useProfile } from "@/hooks/use-profile";
import { findDupes, type DupeHuntResult } from "@/services/api/items";
import type { CapturedPhoto } from "@/services/camera";
import { uploadOutfitImage } from "@/services/supabase/storage";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Upload → hunt, as one mutation — the Dupe Hunter half of the Lens sheet.
 *
 * The same order and the same reasons as `use-analyze-outfit`: `imageUrl` must
 * already be a Mila storage URL when `/dupes/find` sees it (§8), and nothing
 * retries, because the call charges a credit and a retried credit-charging call
 * is a double charge.
 *
 * Nothing is written to `outfits`. A hunted inspiration piece is not a look she
 * wore, so it does not belong in her history — the web does not save one either.
 */
export function useFindDupes() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  /** A retry after a failed hunt re-uses the upload — same file, same bytes. */
  const uploaded = useRef<{ localUri: string; imageUrl: string } | null>(null);

  return useMutation<DupeHuntResult, unknown, { photo: CapturedPhoto; maxBudget?: number }>({
    mutationFn: async ({ photo, maxBudget }) => {
      if (!userId) throw new Error("Not signed in.");

      const imageUrl =
        uploaded.current?.localUri === photo.uri
          ? uploaded.current.imageUrl
          : await uploadOutfitImage(userId, photo.uri);
      uploaded.current = { localUri: photo.uri, imageUrl };

      // Same `region` the web sends — the server ranks with it. `maxBudget` is
      // the ceiling she typed in the review step, when she typed one.
      return findDupes({
        imageUrl,
        region: profile?.delivery_country || undefined,
        maxBudget,
      });
    },

    // On settle, not on success: the server charges before the provider call
    // and refunds on a throw, so the balance moved either way.
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.credits(userId),
      });
    },
  });
}
