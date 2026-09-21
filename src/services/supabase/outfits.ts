import { supabase } from "@/services/supabase/client";
import { removeOutfitImage, uploadGeneratedOutfitImage } from "@/services/supabase/storage";
import type { Json } from "@/types/models";
import type { LensAnalysisRecord } from "@/types/look";

/**
 * History reads and deletes go direct through RLS — no secret, no credit, and
 * no permission the database cannot express, so §7's direct-vs-API rule puts
 * them here rather than behind `/api/v1`.
 *
 * Writes follow that same rule, and **both** are direct. Saving a daily look
 * used to be `POST /look/save`, on the assumption that the generated visual had
 * to reach storage server-side. The Phase 11 audit showed otherwise: the web's
 * `saveOutfitToHistory` uses the caller's own client throughout and needs no
 * secret, no credit, and no admin — so an HTTP hop was buying nothing, and §7
 * puts it here. A *Lens analysis* is direct for the same reason: the credit was
 * already charged and metered by `/analysis/outfit`.
 */
export type OutfitRow = {
  id: string;
  image_url: string;
  analysis_result: Json | null;
  match_score: number | null;
  created_at: string;
};

export async function fetchOutfits(userId: string): Promise<OutfitRow[]> {
  const { data, error } = await supabase
    .from("outfits")
    .select("id,image_url,analysis_result,match_score,created_at")
    .eq("user_id", userId)
    // Matches `outfits_user_created_idx (user_id, created_at DESC)`.
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchOutfit(userId: string, id: string): Promise<OutfitRow | null> {
  const { data, error } = await supabase
    .from("outfits")
    .select("id,image_url,analysis_result,match_score,created_at")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Records a Lens analysis in history.
 *
 * `match_score` mirrors `overall_score` because the column is populated only
 * for Lens rows and History sorts and filters on it; `analysis_result` holds
 * the untagged Lens shape that `lib/outfit-history.ts` identifies by its own
 * fields. `image_url` is the storage URL the analysis ran against, so the
 * history card shows the exact frame that was scored.
 */
export async function saveLensAnalysis(
  userId: string,
  input: { imageUrl: string; analysis: LensAnalysisRecord },
): Promise<OutfitRow> {
  const { data, error } = await supabase
    .from("outfits")
    .insert({
      user_id: userId,
      image_url: input.imageUrl,
      analysis_result: input.analysis,
      match_score: input.analysis.overall_score,
    })
    .select("id,image_url,analysis_result,match_score,created_at")
    .single();

  if (error) throw error;
  return data;
}

export type SaveDailyLookInput = {
  imageDataUri: string;
  weather: string;
  vibe: string;
  outfit: Json;
  hair: Json;
  makeup: Json;
  vibe_alignment_score: number;
  forecastRetrievedAt: string | null;
  /** Ids of the hydrated picks shown with this look; the saved row keeps them for re-opening. */
  productIds: string[];
  previewMode: "style_sheet" | "photo_edit";
  /**
   * Snapshot of the eligibility inputs active at save time. The web reads these
   * server-side inside `saveOutfitToHistory`; mobile saves direct, so the
   * caller supplies them — from the same profile row the generate call was
   * built from. A later profile change must never rewrite what this saved look
   * actually showed.
   */
  gender: string | null;
  makeupEnabled: boolean;
  hairLength: string | null;
  photoConsentVersion: string | null;
};

/**
 * Saves a generated look to history: visual to storage, then the row.
 *
 * The compensating delete is the point. The upload and the insert are two
 * operations with no transaction between them, so a failed insert would
 * otherwise leave an orphaned image in the member's bucket for good. The web's
 * `saveOutfitToHistory` does exactly this, and the behaviour is carried over
 * rather than reinvented.
 *
 * The cleanup is best-effort on purpose: if it fails too, the member still gets
 * the real error about the save, not a second one about tidying up.
 */
export async function saveDailyLook(
  userId: string,
  input: SaveDailyLookInput,
): Promise<OutfitRow> {
  const { publicUrl, storagePath } = await uploadGeneratedOutfitImage(userId, input.imageDataUri);

  const { data, error } = await supabase
    .from("outfits")
    .insert({
      user_id: userId,
      image_url: publicUrl,
      // Key-for-key the web's row. `makeup` is nullable — the server omits the
      // section entirely for makeup-ineligible members, and history renders
      // the absence rather than inventing one.
      analysis_result: {
        type: "daily_look",
        weather: input.weather,
        vibe: input.vibe,
        vibe_alignment_score: input.vibe_alignment_score,
        outfit: input.outfit,
        hair: input.hair,
        makeup: input.makeup,
        forecastRetrievedAt: input.forecastRetrievedAt,
        productIds: input.productIds,
        previewMode: input.previewMode,
        gender: input.gender,
        makeupEnabled: input.makeupEnabled,
        hairLength: input.hairLength,
        photoConsentVersion: input.photoConsentVersion,
      },
      match_score: null,
    })
    .select("id,image_url,analysis_result,match_score,created_at")
    .single();

  if (error) {
    await removeOutfitImage(storagePath).catch(() => {});
    throw error;
  }

  return data;
}

/**
 * `user_id` is in the predicate as well as the id. RLS already scopes this, but
 * §7 is explicit that RLS is the floor and not the ceiling — and a delete is
 * the one operation where a missing scope is unrecoverable.
 */
export async function deleteOutfit(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("outfits").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}
