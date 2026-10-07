import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ClimateState } from "@/constants/climate";
import { queryKeys } from "@/constants/query-keys";
import type { Vibe } from "@/constants/vibes";
import { useProfile } from "@/hooks/use-profile";
import {
  generateDailyLook,
  isGenerationRunning,
  type GenerationRunning,
  type LookResponse,
} from "@/services/api/look";
import { trackEvent } from "@/services/supabase/analytics";
import { hubById } from "@/services/weather";
import { useAuthStore } from "@/stores/auth-store";

import { generationJobsKey } from "./use-generation-jobs";

/** The optional agenda fields the hero form collects, when the member fills them in. */
export type LookAgenda = {
  agenda?: string;
  dressCode?: string;
  indoorOutdoor?: "Indoor" | "Outdoor" | "Mixed";
};

/** Every look request shares this key, so the cache can find it by kind. */
export const GENERATE_LOOK_KEY = ["generation", "look"] as const;

export type GenerateLookVariables = { weather: ClimateState; vibe: Vibe } & LookAgenda & {
  /**
   * The press's idempotency key, minted once per press (R7). The server charges
   * a key once: a repeat replays the stored look, and while that look is still
   * being composed it answers `{ status: "running", jobId }` instead.
   */
  clientRequestId: string;
};

/**
 * `POST /look/generate` — **1 credit**, charged server-side, which also sets
 * `look_image_pending` so the first visual is free. The visual is a separate
 * call and must stay separate: the accounting depends on the sequence (§6).
 *
 * No retry. A retried credit-charging call is a double charge, and the query
 * client's `mutations: { retry: false }` default is restated nowhere because it
 * applies to every mutation in the app.
 */
export function useGenerateLook() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  return useMutation<LookResponse | GenerationRunning, unknown, GenerateLookVariables>({
    mutationKey: GENERATE_LOOK_KEY,
    mutationFn: ({ weather, vibe, agenda, dressCode, indoorOutdoor, clientRequestId }) => {
      // The sub-season is the more precise input and is what the web's
      // normalised profile sends; the base family is the fallback for a legacy
      // row whose analysis only ever wrote the column.
      const colorSeason = profile?.color_season ?? profile?.color_season_base;
      if (!profile?.body_type || !colorSeason) {
        // Unreachable through the UI — the CTA is blocked on an incomplete
        // profile — but the API requires both, and a 400 here would surface as
        // an unexplained validation error rather than the real cause.
        throw new Error("Style Profile is incomplete.");
      }

      const hub = hubById(profile.default_location);

      return generateDailyLook({
        bodyType: profile.body_type,
        colorSeason,
        skinUndertone: profile.skin_undertone ?? undefined,
        faceShape: profile.face_shape ?? undefined,
        hairType: profile.hair_type ?? undefined,
        // The same composed summary the web sends — the label alone loses the
        // city, and the prompt's "Verbal summary" line reads the whole string.
        weather: `${weather.label} (in ${weather.location})`,
        tempC: weather.tempC,
        tempF: weather.tempF,
        condition: weather.condition,
        location: weather.location,
        lat: hub?.lat,
        lon: hub?.lon,
        vibe,
        agenda: agenda?.trim() || undefined,
        dressCode: dressCode?.trim() || undefined,
        indoorOutdoor,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }, clientRequestId);
    },

    onSuccess: (data, { vibe }) => {
      // "Running" means another request's look is still being composed; this
      // call composed nothing, so it is not a generated look.
      if (userId && !isGenerationRunning(data)) trackEvent(userId, "look_generated", { vibe });
    },

    /**
     * On settle, not on success. A failure may still have moved the ledger —
     * the server charges before the provider call and refunds on a throw or a
     * schema mismatch — so the balance is re-read either way.
     *
     * Declared here rather than in a `mutate()` callback so it still runs if the
     * member leaves the screen mid-generation. A paid call is never silently
     * discarded: her generation jobs are re-read too, so a look that finished
     * after its answer was lost (or that is still running) is picked up.
     */
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
      void queryClient.invalidateQueries({ queryKey: generationJobsKey(userId) });
    },
  });
}
