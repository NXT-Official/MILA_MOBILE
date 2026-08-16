import type { PostItem } from "@/lib/outfit-items";

import { api, TIMEOUTS } from "./client";

/**
 * Feed and member profiles. Everything here is free — no credit, no rate limit —
 * but all of it goes through `/api/v1` rather than direct Supabase, because the
 * `posts` bucket is **private**: only the server can mint the signed URLs, and
 * only the server can re-check that a post's image paths belong to its author.
 */

/**
 * `image_url_back` / `image_url_front` are **1-hour signed URLs**, not paths.
 * Treat them as expiring — `RemoteImage` refetches this query on a load failure
 * rather than showing a broken frame. The client never addresses a private
 * object by path.
 */
export type FeedPost = {
  id: string;
  user_id: string;
  caption: string | null;
  created_at: string;
  generated_look_id: string | null;
  image_url_back: string;
  image_url_front: string;
  author_name: string | null;
  author_verified: boolean;
  is_self: boolean;
  /** Garments detected in the back capture; empty when detection was skipped or failed. */
  items: PostItem[];
  /**
   * Only ever present on `/profile/member`, and only for a caller the server
   * decided may see it. `/posts/feed` omits hidden posts entirely, so an absent
   * flag means visible.
   */
  hidden?: boolean;
  hidden_reason?: string | null;
};

export type FeedResponse = {
  has_posted_today: boolean;
  posts: FeedPost[];
};

/**
 * Up to 80 posts with up to 160 signed URLs in one request. That is the current
 * contract (Appendix D.5 proposes `?cursor=&limit=20`; it is still undecided),
 * so the client ships against it and the payload gets measured on a real
 * connection rather than guessed at.
 */
export function getFeed(): Promise<FeedResponse> {
  return api.get<FeedResponse>("/posts/feed", { timeoutMs: TIMEOUTS.default });
}

/**
 * Takes storage **paths**, not URLs. Both must start with `${userId}/` — storage
 * RLS governs uploads, but it says nothing about what a database row may
 * reference, so the server re-checks. Without that a member could publish a post
 * pointing at someone else's image and claim it as her own.
 */
export type CreatePostInput = {
  image_path_back: string;
  image_path_front: string;
  caption?: string | null;
  generated_look_id?: string | null;
};

export function createPost(input: CreatePostInput): Promise<{ id: string }> {
  return api.post<{ id: string }>("/posts/create", input, { timeoutMs: TIMEOUTS.default });
}

/** The web's cap, restated here so the composer and the server agree. */
export const MAX_CAPTION_LENGTH = 500;



export type MemberProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  verified: boolean;
};

export type MemberProfileResponse = {
  profile: MemberProfile;
  posts: FeedPost[];
  /**
   * Computed server-side, and on mobile it is true only for one's own profile —
   * the moderation role that would also satisfy it does not exist in this
   * application and must never be introduced.
   */
  can_view_hidden: boolean;
};

export function getMemberProfile(userId: string): Promise<MemberProfileResponse> {
  return api.get<MemberProfileResponse>(
    `/profile/member?user_id=${encodeURIComponent(userId)}`,
    { timeoutMs: TIMEOUTS.default },
  );
}
