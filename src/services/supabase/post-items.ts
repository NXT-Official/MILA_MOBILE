import {
  normalizeSourceUrl,
  type BBox,
  type ClothingAttributes,
  type PostItem,
} from "@/lib/outfit-items";
import { supabase } from "@/services/supabase/client";
import type { Json } from "@/types/models";

/**
 * Editing the garment tags on your own post — **direct through RLS**.
 *
 * This was `POST /items/update`. The Phase 11 audit found the web's
 * `updatePostItems` runs entirely on the caller's own client: no secret, no
 * credit, no admin. `Post owners manage their post items` scopes every write to
 * posts you own, and it does so in the database rather than in a `.eq()` here,
 * so §7's direct-vs-API rule puts this on Supabase.
 *
 * The ownership `.eq("user_id", …)` below is still sent. RLS is the floor, not
 * the ceiling (§7) — and it also turns "someone else's post" into a clean
 * "Post not found." rather than a silent no-op.
 */
const ITEM_COLUMNS = "id,label,category,attributes,bbox,source_url";

type PostItemRow = {
  id: string;
  label: string;
  category: string;
  attributes: Json;
  bbox: Json;
  source_url: string | null;
};

function toPostItem(row: PostItemRow): PostItem {
  return {
    id: row.id,
    label: row.label,
    category: row.category,
    attributes: row.attributes as unknown as ClothingAttributes,
    bbox: row.bbox as unknown as BBox,
    source_url: row.source_url,
  };
}

export type PostItemUpdate = {
  id: string;
  label: string;
  source_url: string | null;
};

/**
 * **Items absent from the array are deleted** — a replace, not a patch, so the
 * caller sends the full surviving list. Carried over from the web unchanged;
 * changing it on one client only would mean two different meanings for a save.
 */
export async function updatePostItems(
  userId: string,
  input: { post_id: string; items: PostItemUpdate[] },
): Promise<PostItem[]> {
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id")
    .eq("id", input.post_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (postError) throw postError;
  if (!post) throw new Error("Post not found.");

  // Poster links are untrusted. Anything that isn't https is refused rather
  // than quietly dropped, so a typo doesn't look like it saved.
  const items = input.items.map((item) => {
    const raw = item.source_url?.trim();
    const url = raw ? normalizeSourceUrl(raw) : null;
    if (raw && !url) throw new Error(`"${raw}" isn't a valid https link.`);
    return { ...item, source_url: url };
  });

  const keptIds = items.map((item) => item.id);
  let removals = supabase.from("post_items").delete().eq("post_id", input.post_id);
  if (keptIds.length) removals = removals.not("id", "in", `(${keptIds.join(",")})`);
  const { error: deleteError } = await removals;
  if (deleteError) throw deleteError;

  // At most MAX_DETECTED_ITEMS rows, each with different values — not worth a
  // bulk-upsert dance that would need every NOT NULL column resent.
  const updates = await Promise.all(
    items.map((item) =>
      supabase
        .from("post_items")
        .update({ label: item.label, source_url: item.source_url })
        .eq("id", item.id)
        .eq("post_id", input.post_id)
        .select(ITEM_COLUMNS)
        .maybeSingle(),
    ),
  );

  const failed = updates.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return updates.flatMap((result) => (result.data ? [toPostItem(result.data)] : []));
}
