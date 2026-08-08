import type { Profile } from "@/types/models";

/**
 * HAND-WRITTEN to the architecture doc §7. The web project's
 * `src/lib/style-profile/completion.ts` is the real source and must be copied
 * over this file (Appendix A) — this is the onboarding gate, and two
 * implementations mean a member can be "complete" on one client and not the
 * other.
 *
 * All six are required: skin_undertone, color_season, body_type, face_shape,
 * hair_type, and a non-empty color_profile containing `season` or
 * `primarySwatches`.
 */
export function isStyleProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile) return false;

  const required = [
    profile.skin_undertone,
    profile.color_season,
    profile.body_type,
    profile.face_shape,
    profile.hair_type,
  ];
  if (required.some((value) => !value)) return false;

  const colorProfile = profile.color_profile;
  if (!colorProfile || typeof colorProfile !== "object") return false;

  return "season" in colorProfile || "primarySwatches" in colorProfile;
}
