/**
 * NARROW, HAND-WRITTEN types for the columns Phase 01 reads, taken from the
 * architecture doc §7. They are deliberately not a full schema: fabricating one
 * would be worse than admitting the gap.
 *
 * `src/services/supabase/types.ts` still needs the real generated file copied
 * from the web project (Appendix A). When it lands, derive these from it.
 */

/** The six fields `isStyleProfileComplete()` requires, plus the gate columns. */
export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  suspended: boolean | null;

  skin_undertone: string | null;
  color_season: string | null;
  body_type: string | null;
  face_shape: string | null;
  hair_type: string | null;
  color_profile: Record<string, unknown> | null;
};

/** Columns a member is granted INSERT/UPDATE on — §7. Never send others. */
export const PROFILE_WRITABLE_COLUMNS = [
  "full_name",
  "username",
  "skin_undertone",
  "color_season",
  "body_type",
  "color_profile",
  "face_shape",
  "hair_type",
  "beauty_preferences",
  "default_location",
  "updated_at",
] as const;

/** The columns Phase 01 selects. Kept explicit so a schema change fails loudly. */
export const PROFILE_GATE_COLUMNS =
  "id, full_name, username, suspended, skin_undertone, color_season, body_type, face_shape, hair_type, color_profile";
