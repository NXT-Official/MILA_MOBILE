import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import {
  generatePhotoPreview,
  type GenerationRunning,
  type PhotoPreviewResult,
} from "@/services/api/look";
import { useAuthStore } from "@/stores/auth-store";

import { generationJobsKey } from "./use-generation-jobs";
import type { VisualVariables } from "./use-style-sheet";

/** Every request of this render shares this key, so the cache can find it by kind. */
export const PHOTO_PREVIEW_KEY = ["generation", "photo_preview"] as const;

/**
 * `POST /look/photo-preview` — the optional portrait edit: the member's own
 * selfie with the outfit composited on. 1 credit, charged server-side; it is
 * the secondary visual beside the style sheet and never replaces it.
 *
 * Same partial-result contract as the style sheet: `mode: "unavailable"` is a
 * successful response, and the caller answers with copy and a retry.
 */
export function usePhotoPreview() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<PhotoPreviewResult | GenerationRunning, unknown, VisualVariables>({
    mutationKey: PHOTO_PREVIEW_KEY,
    mutationFn: ({ outfit, clientRequestId }) => generatePhotoPreview(outfit, clientRequestId),
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
      void queryClient.invalidateQueries({ queryKey: generationJobsKey(userId) });
    },
  });
}
