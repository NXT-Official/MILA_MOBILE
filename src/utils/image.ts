import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Resize and compress before upload (§5).
 *
 * A raw phone capture is 3–6 MB. At 1440px / q0.85 the same frame is
 * ~200–500 KB, which is the difference between a Lens analysis that works on
 * cellular data and one that does not — and it is the only thing standing
 * between a 2 GB device and an OOM while the bitmap is resident.
 *
 * Called from the camera adapters rather than from the upload boundary, so the
 * iOS HEIC → JPEG transcode happens in the same pass: the backend accepts only
 * jpeg/png/webp.
 */

/** The long edge, in pixels. Enough detail for a garment read, not more. */
export const UPLOAD_MAX_EDGE = 1440;

/** JPEG quality. Below ~0.8 the compression artefacts read as fabric texture. */
export const UPLOAD_QUALITY = 0.85;

export type PreparedImage = { uri: string; width: number; height: number };

/**
 * The resize argument for a source of the given dimensions, or `null` when the
 * image is already small enough to leave alone.
 *
 * Constraining the **longer** edge is the part that is easy to get wrong: a
 * fixed `{ width: 1440 }` leaves a portrait 3000×4000 capture at 1440×1920, so
 * the file is still nearly twice the intended size — and it *upscales* anything
 * narrower than the cap, adding bytes and no detail.
 *
 * Pure, and separated from the native call so it can be tested.
 */
export function resizeTarget(
  source: { width: number; height: number },
  maxEdge: number = UPLOAD_MAX_EDGE,
): { width: number | null; height: number | null } | null {
  const longest = Math.max(source.width, source.height);

  // A picker can report 0 when the system did not provide dimensions. Sending
  // no resize is right: the encoder pass still runs, and guessing an axis from
  // a zero would stretch the image.
  if (!Number.isFinite(longest) || longest <= 0 || longest <= maxEdge) return null;

  return source.width >= source.height
    ? { width: maxEdge, height: null }
    : { width: null, height: maxEdge };
}

/**
 * SDK 57: `manipulateAsync` is deprecated. The contextual API schedules the
 * transforms on a background thread and `renderAsync` awaits them.
 *
 * The encoder pass runs even when no resize is needed — that is what produces
 * a JPEG at a predictable quality from a HEIC or an oversized PNG.
 */
export async function prepareUpload(
  source: { uri: string; width: number; height: number },
  maxEdge: number = UPLOAD_MAX_EDGE,
): Promise<PreparedImage> {
  const target = resizeTarget(source, maxEdge);

  const context = ImageManipulator.manipulate(source.uri);
  if (target) context.resize(target);

  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: UPLOAD_QUALITY, format: SaveFormat.JPEG });

  return { uri: result.uri, width: result.width, height: result.height };
}
