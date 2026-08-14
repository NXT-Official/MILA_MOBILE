import { supabase } from "@/services/supabase/client";
import type { Json } from "@/types/models";

/**
 * History reads and deletes go direct through RLS — no secret, no credit, and
 * no permission the database cannot express, so §7's direct-vs-API rule puts
 * them here rather than behind `/api/v1`.
 *
 * Writes do not: a saved look is created by `POST /look/save`, because the
 * visual has to reach storage server-side.
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
 * `user_id` is in the predicate as well as the id. RLS already scopes this, but
 * §7 is explicit that RLS is the floor and not the ceiling — and a delete is
 * the one operation where a missing scope is unrecoverable.
 */
export async function deleteOutfit(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("outfits").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}
