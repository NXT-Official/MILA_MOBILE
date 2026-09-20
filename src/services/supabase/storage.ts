import { randomUUID } from "expo-crypto";
import { File } from "expo-file-system";

import { dataUriMimeType, dataUriToBytes } from "@/utils/data-uri";

import { supabase } from "./client";

const BUCKET = "outfits";
const POSTS_BUCKET = "posts";
const PROFILE_PHOTOS_BUCKET = "profile-photos";
const PROFILE_PHOTO_SIGNED_URL_TTL_SECONDS = 300;

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
 * Uploads the generated look's visual, which arrives as a base64 `data:` URI
 * rather than a file on disk, and returns both its public URL and its storage
 * path — the path so the caller can undo the upload if the row insert fails.
 *
 * Same `${userId}/` prefix and the same storage RLS as `uploadOutfitImage`: the
 * first path segment must equal `auth.uid()`, and the database rejects a
 * mismatch rather than this function.
 */
export async function uploadGeneratedOutfitImage(
  userId: string,
  dataUri: string,
): Promise<{ publicUrl: string; storagePath: string }> {
  const storagePath = `${userId}/${randomUUID()}.jpg`;
  const bytes = dataUriToBytes(dataUri);

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: dataUriMimeType(dataUri) ?? "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  return {
    publicUrl: supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl,
    storagePath,
  };
}

/** Undoes an upload whose row never landed. Best-effort: see `saveDailyLook`. */
export async function removeOutfitImage(storagePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath]);
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

/**
 * The consented selfie the AI photo-edit pipeline composites onto — separate
 * from `posts` and `outfits`, and private like `posts`: `profile-photos` has
 * no public URL, so a caller wanting to display it needs
 * `getSignedProfilePhotoUrl` below. Same `${userId}/` RLS prefix as every
 * other bucket here.
 */
export async function uploadProfilePhoto(userId: string, uri: string): Promise<string> {
  const path = `${userId}/${randomUUID()}.jpg`;
  const bytes = await readBytes(uri);

  const { error } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    // A fresh selfie always gets a fresh path — the caller deletes the old
    // one only after the profile row's write to it succeeds (see
    // `saveConsentedProfilePhoto`), so there is never a path to collide with.
    upsert: false,
  });
  if (error) throw error;

  return path;
}

/** Best-effort cleanup of a replaced or removed selfie — never blocks the caller. */
export async function removeProfilePhoto(storagePath: string): Promise<void> {
  await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([storagePath]);
}

export async function getSignedProfilePhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, PROFILE_PHOTO_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error("The photo could not be loaded.");
  return data.signedUrl;
}
