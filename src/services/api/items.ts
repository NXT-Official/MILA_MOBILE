import type { ClothingAttributes, PostItem } from "@/lib/outfit-items";

import { api, TIMEOUTS } from "./client";

/**
 * Garment detection, tagging, and the free similar-items lookup.
 *
 * Note what is **not** here: `/dupes/find`, which costs a credit and runs a
 * vision call on a captured image. Phase 06 ships only the free
 * attribute-based path.
 */

/**
 * **1 credit, refunded server-side if nothing is detected**, 10/hour.
 *
 * No image URL crosses the wire: the server reads the back image's path from
 * the post row and mints its own 120s signed URL, so there is no
 * client-supplied URL for a server-side fetch to be pointed at.
 *
 * Best-effort by design — the web's publish flow never rethrows this, because a
 * failed detection must not undo a post that already published successfully.
 */
export function analyzeOutfitItems(postId: string): Promise<PostItem[]> {
  return api.post<PostItem[]>("/items/analyze", { post_id: postId }, {
    timeoutMs: TIMEOUTS.analysis,
  });
}

/**
 * Free. **Items absent from the array are deleted** — this is a replace, not a
 * patch, so the caller sends the full surviving list.
 *
 * A non-https `source_url` is **refused with an error**, not silently dropped.
 * `normalizeSourceUrl` catches it client-side first so a typo reports inline
 * rather than as a failed save.
 */
export type PostItemUpdate = {
  id: string;
  label: string;
  source_url: string | null;
};

export function updatePostItems(input: {
  post_id: string;
  items: PostItemUpdate[];
}): Promise<PostItem[]> {
  return api.post<PostItem[]>("/items/update", input, { timeoutMs: TIMEOUTS.default });
}

/** One row of the affiliate catalogue, scored against the garment's attributes. */
export type DupeMatch = {
  id: string;
  title: string;
  brand_id: string;
  category: string;
  price: number;
  currency: string;
  image_url: string | null;
  affiliate_link: string;
  description: string | null;
  match_score: number;
  match_reasons: string[];
};

/**
 * **Free, and no AI call.** The attributes were already catalogued when the post
 * was analysed, so this is a catalogue query — opening a hotspot costs nothing
 * and must never be gated behind the paywall.
 */
export function findSimilarItems(input: {
  attributes: ClothingAttributes;
  maxResults?: number;
}): Promise<DupeMatch[]> {
  return api.post<DupeMatch[]>("/dupes/similar", input, { timeoutMs: TIMEOUTS.default });
}
