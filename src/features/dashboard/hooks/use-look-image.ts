import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { regenerateOutfitImage, type LookImageResult } from "@/services/api/look";
import { useAuthStore } from "@/stores/auth-store";
import type { DailyLook } from "@/types/look";

/**
 * `POST /look/image` — free the first time (it claims the `look_image_pending`
 * flag that `/look/generate` set), 1 credit every time after.
 *
 * Fired independently of the generate call and never awaited by the screen: the
 * written look is the product and lands in ~10s, the image budgets 75s
 * server-side. Blocking one on the other would hide a finished composition
 * behind a slow picture.
 *
 * A null `imageDataUri` is a **successful response**, not a throw — the server
 * has already re-marked the flag or refunded. The caller keeps the look on
 * screen and offers a retry.
 */
export function useLookImage() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<LookImageResult, unknown, DailyLook>({
    mutationFn: regenerateOutfitImage,
    onSettled: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
    },
  });
}
