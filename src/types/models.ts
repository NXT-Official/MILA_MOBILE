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
  /** Her handle. The only handle there is: never derived from her email. */
  username: string | null;
  face_shape: string | null;
  hair_type: string | null;
  /**
   * Required on the web since the gender step landed. `"Male"` is the one
   * selection that makes a member makeup-ineligible — the same test the
   * server's `computeMakeupEligibility` and the web's review step run.
   */
  gender: string | null;
  /** Required on the web since the hair-length step landed. */
  hair_length: string | null;
  /** One of `MAKEUP_PREFERENCES`; `"none"` is an explicit opt-out, not a missing answer. */
  makeup_preference: string | null;
  /** Tag arrays written by the optional shopping/styling steps; folded into the brief server-side. */
  shopping_preferences: Json | null;
  styling_constraints: Json | null;
  /** ISO 3166-1 alpha-2. Sent as `region` on catalog calls so picks match the member's market. */
  delivery_country: string | null;
  beauty_preferences: Json | null;
  color_profile: Json | null;
  default_location: string | null;
  /** Up to `STYLE_GOAL_LIMIT`; the server folds these into the daily-look brief. */
  style_goals: string[];
  suspended: boolean;
  /**
   * Set together by `saveConsentedProfilePhoto` (web's own naming) — a
   * consented selfie the AI photo-edit pipeline composites onto instead of a
   * generic model. `photo_consent_at` is the gate the web dashboard checks
   * before attempting that edit; `profile_photo_path` is the storage object it
   * reads, private to `${id}/` under the `profile-photos` bucket.
   */
  photo_consent_at: string | null;
  profile_photo_path: string | null;
  /** Separate from `skin_undertone` (warm/cool/neutral) — how light or deep the skin reads. */
  skin_depth: string | null;
  /** Optional. Stored in metric regardless of the unit the member entered in. */
  height_cm: number | null;
  weight_kg: number | null;
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
  /** Wave D: her hair colour as the read saw it. A HAIR_COLORS value; filled only when she had none. */
  hairColor?: string;
  /** Wave D: her skin depth as the read saw it (SKIN_DEPTHS). */
  skinDepth?: string;
};

/**
 * The colour read's telemetry — the debug trail the web viewfinder renders in
 * its studio log. Carried here so the response type mirrors the server payload
 * field-for-field even while nothing on a phone renders it yet.
 */
export type PersonalColorTelemetry = {
  pass1Raw: {
    ambientLighting: string;
    biologicalUndertone: string;
    computedContrast: string;
  };
  interceptTriggered: boolean;
  gatekeeperNotes: string[];
  pass2OverrideInputs: {
    ambientLighting: string;
    biologicalUndertone: string;
    computedContrast: string;
    sensorClippingEvent: boolean;
  };
  forcedDiagnostic: boolean;
};

/**
 * The `POST /analysis/personal-color` answer. Failures ride the **200** as
 * `{ success: false, error }` — the endpoint's own contract, unlike the shared
 * HTTP taxonomy — so the caller must branch on `success`; a thrown `ApiError`
 * is a different class of failure entirely (auth, transport).
 */
export type PersonalColorAnalysisResult =
  | {
      success: true;
      profile: StudioColorProfile;
      telemetry: PersonalColorTelemetry;
      /** The generation job that recorded this read, once the server writes one. */
      jobId?: string;
    }
  | { success: false; error: string };

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
  "gender",
  "hair_length",
  "makeup_preference",
  "shopping_preferences",
  "styling_constraints",
  "delivery_country",
  "beauty_preferences",
  "default_location",
  "style_goals",
  "updated_at",
  "photo_consent_at",
  "profile_photo_path",
  "skin_depth",
  "height_cm",
  "weight_kg",
  "hair_color",
  "last_check_in_at",
] as const;

/**
 * The columns every profile read selects. Kept explicit so a schema change
 * fails loudly, and so `suspended` and `paddle_customer_id` are never pulled
 * into a payload by a `select("*")`.
 */
export const PROFILE_READ_COLUMNS =
  "body_type,color_season,skin_undertone,full_name,username,color_profile,face_shape,hair_type,gender,hair_length,makeup_preference,shopping_preferences,styling_constraints,delivery_country,beauty_preferences,default_location,style_goals,suspended,photo_consent_at,profile_photo_path,skin_depth,height_cm,weight_kg";
