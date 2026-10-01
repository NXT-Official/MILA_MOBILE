import {
  BODIES,
  FACE_SHAPES,
  GENDERS,
  HAIR_LENGTHS,
  HAIR_TYPES,
  SEASONS,
  SKIN_DEPTHS,
  UNDERTONES,
} from "@/constants/style-profile";
import { isNonEmptyColorProfile, type StyleProfileRow } from "@/lib/style-profile/completion";

/**
 * The web's completion score, ported verbatim from its
 * `lib/queries/dashboard-stats.ts`: nine profile facts, each answered or not.
 * Both clients must round to the same percentage or one member reads two
 * different numbers for the same profile.
 */
const PROFILE_FIELD_CHECKS: ((profile: StyleProfileRow) => boolean)[] = [
  (p) => (UNDERTONES as readonly string[]).includes(p.skin_undertone ?? ""),
  (p) => (SEASONS as readonly string[]).includes(p.color_season ?? ""),
  (p) => (BODIES as readonly string[]).includes(p.body_type ?? ""),
  (p) => (FACE_SHAPES as readonly string[]).includes(p.face_shape ?? ""),
  (p) => (HAIR_TYPES as readonly string[]).includes(p.hair_type ?? ""),
  (p) => (HAIR_LENGTHS as readonly string[]).includes(p.hair_length ?? ""),
  (p) => (GENDERS as readonly string[]).includes(p.gender ?? ""),
  (p) => (SKIN_DEPTHS as readonly string[]).includes(p.skin_depth ?? ""),
  (p) => isNonEmptyColorProfile(p.color_profile),
];

export function styleProfileCompletionPercent(
  profile: StyleProfileRow | null | undefined,
): number {
  if (!profile) return 0;
  const passed = PROFILE_FIELD_CHECKS.filter((check) => check(profile)).length;
  return Math.round((passed / PROFILE_FIELD_CHECKS.length) * 100);
}

/** The web's strip shows six tiles; both clients read the same rows, newest first. */
export const RECENT_LOOKS_LIMIT = 6;

/**
 * The web computes its dashboard numbers in one dedicated query. Mobile already
 * holds the member's own rows — History reads them directly through RLS, newest
 * first — so the same numbers come out of that array rather than a second trip.
 *
 * Deliberately generic over the row shape: `lib/` is a pure layer and may not
 * import from `services/`, so the caller's own row type comes back out of it.
 */
export function recentLooks<T extends { created_at: string }>(outfits: T[]): T[] {
  return outfits.slice(0, RECENT_LOOKS_LIMIT);
}

export function looksThisMonth(
  outfits: { created_at: string }[],
  now: Date = new Date(),
): number {
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return outfits.filter((row) => new Date(row.created_at) >= monthStart).length;
}
