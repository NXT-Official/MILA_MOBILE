import { supabase } from "@/services/supabase/client";
import type { Json } from "@/types/models";
import type { LensAnalysisRecord } from "@/types/look";

/**
 * History reads and deletes go direct through RLS — no secret, no credit, and
 * no permission the database cannot express, so §7's direct-vs-API rule puts
 * them here rather than behind `/api/v1`.
 *
 * Writes split on that same rule. A saved *daily look* is created by
 * `POST /look/save`, because the generated visual has to reach storage
 * server-side. A *Lens analysis* is not: the credit was already charged and
 * metered by `/analysis/outfit`, and the row that records the result needs
 * nothing RLS cannot express — so `saveLensAnalysis` inserts directly, matching
 * the web.
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

/**
 * `user_id` is in the predicate as well as the id. RLS already scopes this, but
 * §7 is explicit that RLS is the floor and not the ceiling — and a delete is
 * the one operation where a missing scope is unrecoverable.
 */
export async function deleteOutfit(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("outfits").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}
