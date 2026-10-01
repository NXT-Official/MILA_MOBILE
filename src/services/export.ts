import { getMemberProfile } from "@/services/api/posts";
import { supabase } from "@/services/supabase/client";
import { fetchOutfits } from "@/services/supabase/outfits";
import { fetchSavedPalettes } from "@/services/supabase/palettes";
import { fetchProfile } from "@/services/supabase/profile";

/**
 * The member's data, assembled client-side.
 *
 * Everything here is already hers and already readable by her session — this
 * adds no new access, it only gathers what RLS already returns into one file.
 * `posts` goes through the API because its images live in a private bucket and
 * only the server can sign their URLs (§5).
 *
 * Deliberately **not** included: credits and subscription rows. Those are
 * billing records rather than personal data, they change without her acting,
 * and a stale figure in an exported file is worse than its absence.
 */
export type ExportedData = {
  exported_at: string;
  /**
   * Who the export belongs to — the web's `account` field. Without it a member
   * holding two exports cannot tell which account either one came from.
   */
  account: { id: string; email: string | null };
  profile: unknown;
  outfits: unknown[];
  posts: unknown[];
  saved_palettes: unknown[];
  favourites: unknown[];
};

export async function assembleExport(account: {
  id: string;
  email: string | null;
}): Promise<ExportedData> {
  const userId = account.id;

  // Independent reads, so they go together. A failure in any one rejects the
  // whole export rather than handing her a file with a silently missing
  // section — an incomplete export that looks complete is the worse outcome.
  const [profile, outfits, palettes, favourites, member] = await Promise.all([
    fetchProfile(userId),
    fetchOutfits(userId),
    fetchSavedPalettes(userId),
    fetchFavourites(userId),
    getMemberProfile(userId),
  ]);

  return {
    exported_at: new Date().toISOString(),
    account,
    profile,
    outfits,
    posts: member.posts,
    saved_palettes: palettes,
    favourites,
  };
}

async function fetchFavourites(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("user_favorites")
    .select("id,product_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Stable, dated, and obvious in a downloads folder. */
export function exportFilename(now = new Date()): string {
  return `mila-data-${now.toISOString().slice(0, 10)}.json`;
}
