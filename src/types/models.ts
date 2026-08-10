import type { DetailedColorProfile, Season, Swatch } from "@/constants/style-profile";
import type { Json } from "@/services/supabase/types";

export type { Json };

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

/**
 * The normalised profile every screen reads — the web's `DashboardProfile`,
 * carried over unchanged so the step machine resumes identically on both
 * clients. `color_season` is the *sub*-season for display; `color_season_base`
 * is the raw `profiles.color_season` column the completion gate validates.
 * `toStyleProfileRow()` maps between them.
 *
 * `suspended` is mobile-only: the launch gate (§4) reads suspension from the
 * same query rather than a second round trip on every cold start.
 */
export type DashboardProfile = {
  body_type: string | null;
  color_season: string | null;
  color_season_base: string | null;
  skin_undertone: string | null;
  full_name: string | null;
  face_shape: string | null;
  hair_type: string | null;
  beauty_preferences: Json | null;
  color_profile: Json | null;
  default_location: string | null;
  suspended: boolean;
};

/**
 * The personal-colour analysis result — the shape `POST
 * /api/v1/analysis/personal-color` returns and the shape stored in
 * `profiles.color_profile`.
 *
 * On web this is `z.infer` of a schema declared inside
 * `analyzePersonalColor.functions.ts`, a server module that is never ported
 * (Appendix A). Declared here as a plain type so `studio-dossier.ts` can be
 * copied verbatim without dragging a server module — and every optional field
 * matches the web schema exactly, because a mismatch is a dossier that renders
 * on one client and not the other.
 */
export type StudioColorProfile = {
  season: Season;
  subSeason: string;
  toneType: DetailedColorProfile["toneType"];
  brightness: DetailedColorProfile["brightness"];
  saturation: DetailedColorProfile["saturation"];
  contrastScale: DetailedColorProfile["contrastScale"];
  faceShape: DetailedColorProfile["faceShape"];
  bodyType: DetailedColorProfile["bodyType"];
  primarySwatches: Swatch[];
  secondarySwatches: Swatch[];
  avoidColors: string[];
  beautyMap: { hair: string; lip: string; base: string };
  fabrication: string[];
  accessories: string[];
  denimRegistry: string[];
  stylistNote: string;
  fullPalette?: string[];
  detectedLighting?: string;
  calculatedUndertone?: string;
  confidenceScore?: number;
  confidenceLabel?: string;
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

/**
 * The columns every profile read selects. Kept explicit so a schema change
 * fails loudly, and so `suspended` and `paddle_customer_id` are never pulled
 * into a payload by a `select("*")`.
 */
export const PROFILE_READ_COLUMNS =
  "body_type,color_season,skin_undertone,full_name,color_profile,face_shape,hair_type,beauty_preferences,default_location,suspended";
