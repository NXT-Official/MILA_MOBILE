import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ClimateState } from "@/constants/climate";
import { queryKeys } from "@/constants/query-keys";
import type { Vibe } from "@/constants/vibes";
import { useProfile } from "@/hooks/use-profile";
import { generateDailyLook } from "@/services/api/look";
import { hubById } from "@/services/weather";
import { useAuthStore } from "@/stores/auth-store";
import type { DailyLook } from "@/types/look";

/**
 * `POST /look/generate` — **1 credit**, charged server-side, which also sets
 * `look_image_pending` so the first visual is free. The image is a separate
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

  return useMutation<DailyLook, unknown, { weather: ClimateState; vibe: Vibe }>({
    mutationFn: ({ weather, vibe }) => {
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
        weather: weather.label,
        tempC: weather.tempC,
        tempF: weather.tempF,
        condition: weather.condition,
        location: weather.location,
        lat: hub?.lat,
        lon: hub?.lon,
        vibe,
      });
    },

    /**
     * On settle, not on success. A failure may still have moved the ledger —
     * the server charges before the provider call and refunds on a throw or a
     * schema mismatch — so the balance is re-read either way.
     *
     * Declared here rather than in a `mutate()` callback so it still runs if the
     * member leaves the screen mid-generation. A paid call is never silently
     * discarded.
     */
    onSettled: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
    },
  });
}
