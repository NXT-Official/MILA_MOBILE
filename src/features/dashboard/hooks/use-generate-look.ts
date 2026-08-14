import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { useCreditBalance } from "@/hooks/use-credits";
import { ApiError } from "@/services/api/client";
import { useAuthStore } from "@/stores/auth-store";
import type { Vibe } from "@/constants/vibes";

/** The shape Phase 04's endpoint returns. Nothing produces one yet. */
export type Look = {
  id: string;
  headline: string;
  imageUrl: string | null;
  sections: { title: string; body: string }[];
};

/**
 * PHASE 03 STUB. No AI route exists yet (§15) — this hook is here so the CTA's
 * loading, error, and paywall paths are built and exercised before the happy
 * path arrives to compete with them. Phase 04 replaces the body of `mutationFn`
 * with a call to `services/api/look.ts` and nothing else in this file changes.
 *
 * The stub stands in for the *server*, which is why it is the thing that reads
 * the balance and raises `INSUFFICIENT_CREDITS`. No component may do that: §7
 * makes the server the only authority on affordability, and the UI below
 * switches on the error code exactly as it will when the code is real.
 */
export function useGenerateLook() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const balance = useCreditBalance();
  const queryClient = useQueryClient();

  return useMutation<Look, unknown, { vibe: Vibe }>({
    mutationFn: async () => {
      // Long enough to see the skeletons on a real device, which is the point
      // of the phase. Phase 04's real latency is 5–15s.
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (balance === 0) {
        throw new ApiError(
          "INSUFFICIENT_CREDITS",
          "You're out of credits for today.",
          402,
        );
      }

      throw new ApiError(
        "AI_UNAVAILABLE",
        "Mila couldn't compose a look this time. Please try again.",
        503,
      );
    },
    // On settle, not on success: a failure is the case where the server most
    // likely knows something about the balance that the app does not.
    onSettled: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
      }
    },
  });
}
