/**
 * COPIED VERBATIM from the web's `generate-outfit.functions.ts`
 * (`computeMakeupEligibility`) — the predicate the server applies before it
 * composes a makeup section at all.
 *
 * The mobile writes the saved look's eligibility snapshot itself (saving is
 * direct through RLS, Phase 11), so the rule has to exist on this side too. A
 * drifting copy would make the saved row claim a makeup section the server
 * never rendered, or hide one it did.
 */
export function computeMakeupEligibility(profile: {
  gender: string | null | undefined;
  makeup_preference: string | null | undefined;
}): boolean {
  return (
    profile.gender !== "Male" && !!profile.makeup_preference && profile.makeup_preference !== "none"
  );
}
