import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { generatePhotoPreview, type PhotoPreviewResult } from "@/services/api/look";
import { useAuthStore } from "@/stores/auth-store";
import type { DailyLook } from "@/types/look";

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

  return useMutation<PhotoPreviewResult, unknown, DailyLook>({
    mutationFn: generatePhotoPreview,
    onSettled: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
    },
  });
}
