import { assertWritableColumns } from "@/lib/profile-columns";
import { deriveColorMetrics } from "@/lib/profile-color";
import { supabase } from "@/services/supabase/client";
import {
  getSignedProfilePhotoUrl,
  removeProfilePhoto,
  uploadProfilePhoto,
} from "@/services/supabase/storage";
import {
  PROFILE_READ_COLUMNS,
  type DashboardProfile,
  type Json,
} from "@/types/models";

/**
 * All profile I/O. Normalisation follows the web's `buildDashboardProfile`,
 * with one correction: a manual season library's default face is not a member
 * answer. Legacy AI readings can still supply a missing face column.
 */

const EMPTY_PROFILE: DashboardProfile = {
  body_type: null,
  color_season: null,
  color_season_base: null,
  skin_undertone: null,
  full_name: null,
  face_shape: null,
  hair_type: null,
  gender: null,
  hair_length: null,
  makeup_preference: null,
  shopping_preferences: null,
  styling_constraints: null,
  delivery_country: null,
  beauty_preferences: null,
  color_profile: null,
  default_location: null,
  style_goals: [],
  suspended: false,
  photo_consent_at: null,
  profile_photo_path: null,
  skin_depth: null,
  height_cm: null,
  weight_kg: null,
};

type ProfileRow = {
  body_type: string | null;
  color_season: string | null;
  skin_undertone: string | null;
  full_name: string | null;
  color_profile: Json | null;
  face_shape: string | null;
  hair_type: string | null;
  gender: string | null;
  hair_length: string | null;
  makeup_preference: string | null;
  shopping_preferences: Json;
  styling_constraints: Json;
  delivery_country: string | null;
  beauty_preferences: Json;
  default_location: string | null;
  style_goals: string[] | null;
  suspended: boolean;
  photo_consent_at: string | null;
  profile_photo_path: string | null;
  skin_depth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
};

function normalizeFirstWord(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const first = v.trim().split(/\s+/)[0];
  return first || null;
}

function buildDashboardProfile(data: ProfileRow | null): DashboardProfile {
  if (!data) return EMPTY_PROFILE;

  const metrics = deriveColorMetrics(data);
  const json = data.color_profile as {
    subSeason?: string;
    season?: string;
    faceShape?: string;
    hairType?: string;
    calibrationSource?: string;
    detectedLighting?: string;
  } | null;

  const manualPalette =
    json?.calibrationSource === "Studio Calibrated" ||
    json?.detectedLighting === "Manual Studio Calibration";
  const faceShape = data.face_shape ?? (manualPalette ? null : normalizeFirstWord(json?.faceShape));
  const hairType =
    data.hair_type ??
    (typeof json?.hairType === "string" && json.hairType.trim() ? json.hairType : null);

  return {
    body_type: data.body_type ?? null,
    color_season: json?.subSeason ?? metrics.season ?? null,
    color_season_base: data.color_season ?? null,
    skin_undertone: metrics.undertone,
    full_name: data.full_name ?? null,
    face_shape: faceShape,
    hair_type: hairType,
    gender: data.gender ?? null,
    hair_length: data.hair_length ?? null,
    makeup_preference: data.makeup_preference ?? null,
    shopping_preferences: data.shopping_preferences ?? null,
    styling_constraints: data.styling_constraints ?? null,
    delivery_country: data.delivery_country ?? null,
    beauty_preferences: data.beauty_preferences ?? null,
    color_profile: data.color_profile ?? null,
    default_location: data.default_location ?? null,
    style_goals: data.style_goals ?? [],
    suspended: data.suspended === true,
    photo_consent_at: data.photo_consent_at ?? null,
    profile_photo_path: data.profile_photo_path ?? null,
    skin_depth: data.skin_depth ?? null,
    height_cm: data.height_cm ?? null,
    weight_kg: data.weight_kg ?? null,
  };
}

export async function fetchProfile(userId: string): Promise<DashboardProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_READ_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return buildDashboardProfile(data as ProfileRow | null);
}

/**
 * The permitted column list and nothing else (§7). `suspended` and
 * `paddle_customer_id` are absent by construction rather than by discipline —
 * sending either fails the column grant outright, it does not silently no-op.
 */
export type StyleProfileUpdate = {
  skin_undertone?: string | null;
  color_season?: string | null;
  color_profile?: Json | null;
  body_type?: string | null;
  face_shape?: string | null;
  hair_type?: string | null;
  gender?: string | null;
  hair_length?: string | null;
  /** NOT NULL with a default in the schema — the column never holds null. */
  makeup_preference?: string;
  shopping_preferences?: Json;
  styling_constraints?: Json;
  delivery_country?: string | null;
  beauty_preferences?: Json;
  default_location?: string | null;
  style_goals?: string[];
  skin_depth?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
};

export async function updateStyleProfile(
  userId: string,
  payload: StyleProfileUpdate,
): Promise<void> {
  assertWritableColumns(payload);

  const { error } = await supabase
    .from("profiles")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw error;
}

async function currentProfilePhotoPath(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("profile_photo_path")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.profile_photo_path ?? null;
}

/**
 * The same consent onboarding's colour scan and Style Profile already set —
 * saving here is a shortcut to it, not a separate flag. "Create My Look"
 * checks `photo_consent_at` before its AI photo-edit step, so this is picked
 * up on the member's next generation with no other change needed.
 *
 * Upload-then-swap, not swap-then-upload: the previous photo stays live and
 * usable until the new one is confirmed written to the profile row, and is
 * only removed after — a failed write leaves her with the old photo intact
 * rather than no photo at all.
 */
export async function saveConsentedProfilePhoto(userId: string, uri: string): Promise<void> {
  const previousPath = await currentProfilePhotoPath(userId);
  const storagePath = await uploadProfilePhoto(userId, uri);

  const payload = { profile_photo_path: storagePath, photo_consent_at: new Date().toISOString() };
  assertWritableColumns(payload);
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) {
    await removeProfilePhoto(storagePath);
    throw error;
  }

  if (previousPath) await removeProfilePhoto(previousPath);
}

export async function deleteMyProfilePhoto(userId: string): Promise<void> {
  const previousPath = await currentProfilePhotoPath(userId);

  const payload = { profile_photo_path: null, photo_consent_at: null };
  assertWritableColumns(payload);
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;

  if (previousPath) await removeProfilePhoto(previousPath);
}

/** A signed thumbnail URL for the currently consented photo, or `null` if none. */
export async function fetchProfilePhotoUrl(userId: string): Promise<string | null> {
  const path = await currentProfilePhotoPath(userId);
  if (!path) return null;
  return getSignedProfilePhotoUrl(path);
}
