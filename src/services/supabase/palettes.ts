import type { DailyPalette } from "@/lib/color-analysis/paletteGenerator";
import { isDailyPalette } from "@/lib/saved-palette";
import type { Json } from "@/types/models";

import { supabase } from "./client";

/**
 * Saved palettes. Direct through RLS (§7): no secret, no credit, and no
 * permission the database cannot express. Grants are SELECT/INSERT/DELETE —
 * there is no UPDATE, so a palette is pinned or it is gone.
 */
export type SavedPalette = {
  id: string;
  created_at: string;
  palette: DailyPalette;
};

export async function fetchSavedPalettes(userId: string): Promise<SavedPalette[]> {
  const { data, error } = await supabase
    .from("saved_palettes")
    .select("id,created_at,palette")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // A row that fails validation is skipped, not rendered half-formed.
  return (data ?? [])
    .filter((row) => isDailyPalette(row.palette))
    .map((row) => ({
      id: row.id,
      created_at: row.created_at,
      palette: row.palette as unknown as DailyPalette,
    }));
}

export async function savePalette(userId: string, palette: DailyPalette): Promise<void> {
  const { error } = await supabase.from("saved_palettes").insert({
    user_id: userId,
    palette: palette as unknown as Json,
    style_vibe: palette.styleVibe,
  });

  // 23505 = already pinned. A unique index on (user_id, the three hexes) makes
  // saving idempotent, and the client relies on that rather than reading first —
  // pinning something already pinned is a success, not an error.
  if (error && error.code !== "23505") throw error;
}

export async function deleteSavedPalette(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("saved_palettes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
