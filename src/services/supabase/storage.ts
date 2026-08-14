import { randomUUID } from "expo-crypto";
import { File } from "expo-file-system";

import { supabase } from "./client";

const BUCKET = "outfits";
const POSTS_BUCKET = "posts";

/** Bytes, not a Blob — see `uploadOutfitImage` for why. */
async function readBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

/**
 * Uploads a prepared capture and returns its public URL.
 *
 * **Upload first, then reference.** The analysis endpoint rejects any URL that
 * is not under `${SUPABASE_URL}/storage/v1/object/public/`, and that check is
 * the SSRF defence: a client-supplied arbitrary URL handed to a server-side
 * fetch is a server-side request forgery primitive (§8). Nothing in this app
 * ever sends the server a URL it did not just create here.
 *
 * The path is `${userId}/${uuid}.jpg` because storage RLS requires the first
 * segment to equal `auth.uid()` — a mismatch is rejected by the database, not
 * by this function.
 */
export async function uploadOutfitImage(userId: string, uri: string): Promise<string> {
  const path = `${userId}/${randomUUID()}.jpg`;

  // Bytes, not a Blob: `fetch(uri).blob()` on React Native reads the whole file
  // through the JS bridge as a base64 string first, which is a third of a
  // megabyte of string churn per upload and has a history of arriving empty.
  const bytes = await readBytes(uri);

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    // A UUID collision would be a genuine surprise; overwriting on one would be
    // worse than failing.
    upsert: false,
  });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploads one half of an OOTD and returns its **storage path**, not a URL.
 *
 * The `posts` bucket is private: there is no public URL to return, and
 * `createPost` wants the path anyway. The client never addresses a private
 * object directly — reading one is always a server-minted signed URL that
 * arrives with the feed payload.
 *
 * Both halves share a timestamp so a post's two files sort together and a
 * half-finished session is obvious in the bucket.
 */
export async function uploadPostImage(
  userId: string,
  uri: string,
  side: "back" | "front",
  timestamp: number,
): Promise<string> {
  // The `${userId}/` prefix is enforced by storage RLS **and** re-checked by
  // `createPost` — RLS governs uploads, not what a database row may reference.
  const path = `${userId}/${side}-${timestamp}.jpg`;
  const bytes = await readBytes(uri);

  const { error } = await supabase.storage.from(POSTS_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    // A retried publish after a failed second upload re-sends the first half to
    // the same path. Overwriting her own identical file is the correct outcome;
    // failing would strand the post.
    upsert: true,
  });
  if (error) throw error;

  return path;
}
