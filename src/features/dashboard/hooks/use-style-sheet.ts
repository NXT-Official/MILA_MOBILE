import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import {
  generateStyleSheetPreview,
  type GenerationRunning,
  type StyleSheetResult,
} from "@/services/api/look";
import { useAuthStore } from "@/stores/auth-store";
import type { DailyLook } from "@/types/look";

import { generationJobsKey } from "./use-generation-jobs";

/** Every request of this render shares this key, so the cache can find it by kind. */
export const STYLE_SHEET_KEY = ["generation", "style_sheet"] as const;

/** The look to draw, and the press's idempotency key (minted once per press). */
export type VisualVariables = { outfit: DailyLook; clientRequestId: string };

/**
 * `POST /look/style-sheet` — the identity-locked 5-view visual, rendered from
 * the member's consented selfie. Free the first time (it claims the
 * `look_image_pending` flag that `/look/generate` set), 1 credit every time
 * after — the same claim `/look/image` used to make, so the accounting is
 * unchanged.
 *
 * Fired independently of the generate call and never awaited by the screen: the
 * written look is the product and lands in ~10s; the sheet retries a failed QA
 * check up to three times and budgets far longer. Blocking one on the other
 * would hide a finished composition behind a slow picture.
 *
 * `mode: "unavailable"` is a **successful response**, not a throw — the server
 * has already re-marked the flag or refunded, and answers with a reason. The
 * caller keeps the look on screen and offers the web's retry copy.
 */
export function useStyleSheet() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<StyleSheetResult | GenerationRunning, unknown, VisualVariables>({
    mutationKey: STYLE_SHEET_KEY,
    mutationFn: ({ outfit, clientRequestId }) => generateStyleSheetPreview(outfit, clientRequestId),
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
      void queryClient.invalidateQueries({ queryKey: generationJobsKey(userId) });
    },
  });
}
