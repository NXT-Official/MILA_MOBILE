import type { ClothingAttributes, PostItem } from "@/lib/outfit-items";

import { api, TIMEOUTS } from "./client";

/**
 * Garment detection, tagging, and the two dupe lookups — the free
 * attribute-based one, and the credit-charging vision one the Lens sheet's
 * Dupe Hunter mode runs on a fresh capture.
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
  verification_status: string;
  last_verified_at: string | null;
  rating: number | null;
  units_sold: number | null;
  shipping_info: string | null;
  discount_percent: number | null;
  is_verified_seller: boolean;
};

/**
 * The extracted inspiration piece, plus the catalogue rows ranked against it.
 */
export type DupeHuntResult = {
  inspiration: ClothingAttributes;
  dupes: DupeMatch[];
};

/**
 * **1 credit**, 15/hour, and a vision call — the paid half of the pair below.
 *
 * `imageUrl` must already be a Mila storage URL: the server rejects anything
 * else, because handing a server-side fetch a client-supplied URL is a
 * server-side request forgery primitive (§8). Upload first, then hunt.
 */
export function findDupes(input: {
  imageUrl: string;
  maxResults?: number;
  /** ISO 3166-1 alpha-2 from the profile's delivery country — the web sends it on this call. */
  region?: string;
}): Promise<DupeHuntResult> {
  return api.post<DupeHuntResult>("/dupes/find", input, { timeoutMs: TIMEOUTS.analysis });
}

/**
 * **Free, and no AI call.** The attributes were already catalogued when the post
 * was analysed, so this is a catalogue query — opening a hotspot costs nothing
 * and must never be gated behind the paywall.
 */
export function findSimilarItems(input: {
  attributes: ClothingAttributes;
  maxResults?: number;
  /** ISO 3166-1 alpha-2 from the profile's delivery country — the web sends it on this call. */
  region?: string;
}): Promise<DupeMatch[]> {
  return api.post<DupeMatch[]>("/dupes/similar", input, { timeoutMs: TIMEOUTS.default });
}
