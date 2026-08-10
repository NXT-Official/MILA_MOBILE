import { deriveColorMetrics } from "@/lib/profile-color";
import { supabase } from "@/services/supabase/client";
import {
  PROFILE_READ_COLUMNS,
  type DashboardProfile,
  type Json,
} from "@/types/models";

/**
 * All profile I/O. The normalisation below is the web's `buildDashboardProfile`
 * carried over unchanged — it is what lets a legacy row whose undertone or face
 * shape only ever landed inside `color_profile` still read as complete. Two
 * normalisations is how a member resumes at a different step on each client.
 */

const EMPTY_PROFILE: DashboardProfile = {
  body_type: null,
  color_season: null,
  color_season_base: null,
  skin_undertone: null,
  full_name: null,
  face_shape: null,
  hair_type: null,
  beauty_preferences: null,
  color_profile: null,
  default_location: null,
  suspended: false,
};

type ProfileRow = {
  body_type: string | null;
  color_season: string | null;
  skin_undertone: string | null;
  full_name: string | null;
  color_profile: Json | null;
  face_shape: string | null;
  hair_type: string | null;
  beauty_preferences: Json;
  default_location: string | null;
  suspended: boolean;
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
  } | null;

  const faceShape = data.face_shape ?? normalizeFirstWord(json?.faceShape) ?? null;
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
    beauty_preferences: data.beauty_preferences ?? null,
    color_profile: data.color_profile ?? null,
    default_location: data.default_location ?? null,
    suspended: data.suspended === true,
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
  beauty_preferences?: Json;
  default_location?: string | null;
};

export async function updateStyleProfile(
  userId: string,
  payload: StyleProfileUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw error;
}
