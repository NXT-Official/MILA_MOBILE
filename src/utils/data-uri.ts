const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Reverse lookup, built once. -1 marks a character that is not base64. */
const LOOKUP = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i += 1) table[ALPHABET.charCodeAt(i)] = i;
  return table;
})();

/**
 * Decodes a `data:` URI to raw bytes.
 *
 * The generated look's visual arrives from `/look/image` as a base64 `data:`
 * URI, and Supabase storage wants bytes. React Native has no dependable global
 * `atob` — Hermes does not define one and RN only ships the *encode* half
 * (`binaryToBase64`) — so the decode is written out here rather than assumed.
 *
 * Bytes, not a Blob, for the same reason `uploadOutfitImage` uses them: reading
 * through `fetch(uri).blob()` on React Native round-trips the whole payload
 * across the bridge as a string.
 *
 * Throws on anything that is not a base64 `data:` URI. A silent empty buffer
 * would upload a 0-byte JPEG and fail much later, somewhere less obvious.
 */
export function dataUriToBytes(dataUri: string): Uint8Array {
  const comma = dataUri.indexOf(",");
  if (!dataUri.startsWith("data:") || comma === -1) {
    throw new Error("Not a data URI.");
  }
  if (!dataUri.slice(0, comma).includes(";base64")) {
    throw new Error("Only base64 data URIs are supported.");
  }

  // Whitespace is legal in base64 payloads and some encoders wrap long lines.
  const body = dataUri.slice(comma + 1).replace(/\s/g, "");
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0;
  const usable = body.length - padding;
  const bytes = new Uint8Array(Math.floor((usable * 3) / 4));

  let byte = 0;
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < usable; i += 1) {
    const code = body.charCodeAt(i);
    const value = code < 128 ? LOOKUP[code] : -1;
    if (value === undefined || value < 0) {
      throw new Error("Data URI payload is not valid base64.");
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byte] = (buffer >> bits) & 0xff;
      byte += 1;
    }
  }

  return bytes;
}

/** The declared media type, or null when the URI omits one. */
export function dataUriMimeType(dataUri: string): string | null {
  const comma = dataUri.indexOf(",");
  if (!dataUri.startsWith("data:") || comma === -1) return null;
  const mime = dataUri.slice(5, comma).split(";")[0];
  return mime ? mime : null;
}
