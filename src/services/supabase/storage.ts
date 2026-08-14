import { randomUUID } from "expo-crypto";
import { File } from "expo-file-system";

import { supabase } from "./client";

const BUCKET = "outfits";

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
  const bytes = await new File(uri).bytes();

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    // A UUID collision would be a genuine surprise; overwriting on one would be
    // worse than failing.
    upsert: false,
  });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
