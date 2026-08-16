import { supabase } from "@/services/supabase/client";

/**
 * Post writes that RLS fully enforces — **direct, not `/api/v1`**.
 *
 * `posts/caption` reads like an AI endpoint from its name; the Phase 11 audit
 * showed it is not. The web's `updatePostCaption` is a plain UPDATE on a post
 * you own, running on the caller's own client, so §7's direct-vs-API rule puts
 * it here. Nothing about the naming survived contact with the implementation.
 *
 * `Users can manage their own posts` is what actually enforces ownership. The
 * `user_id` predicate below is sent as well — RLS is the floor, not the
 * ceiling (§7), and it turns "not yours" into a row count of zero rather than
 * a silent success.
 */
export async function updatePostCaption(
  userId: string,
  input: { post_id: string; caption: string | null },
): Promise<{ id: string }> {
  const { error } = await supabase
    .from("posts")
    .update({ caption: input.caption })
    .eq("id", input.post_id)
    .eq("user_id", userId);

  if (error) throw error;
  return { id: input.post_id };
}

/**
 * Deletes your own post, then purges both captures.
 *
 * The order matters and is carried over from the web: the row goes first, and
 * the storage purge is **best-effort**. A failed purge leaves orphaned bytes
 * behind, which is worth logging; failing the whole call would tell a member
 * her post is still there when it is already gone.
 *
 * Direct because every step is owner-scoped: `Users can manage their own posts`
 * for the row, `Users can delete their own post images` for the objects.
 */
export async function deletePost(userId: string, postId: string): Promise<{ id: string }> {
  const { data: row, error: readError } = await supabase
    .from("posts")
    .select("image_url_back,image_url_front")
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) throw new Error("Post not found.");

  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", userId);
  if (error) throw error;

  const { error: removeError } = await supabase.storage
    .from("posts")
    .remove([row.image_url_back, row.image_url_front]);
  if (removeError) console.error("[deletePost] image purge failed", removeError.message);

  return { id: postId };
}
