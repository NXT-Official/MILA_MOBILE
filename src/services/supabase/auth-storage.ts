import * as SecureStore from "expo-secure-store";

/**
 * The Supabase auth storage adapter for the shipped platforms (Android, iOS).
 *
 * Expo enforces no size limit, but the platform can reject large values —
 * historically iOS refused anything above ~2048 bytes. A Supabase session with
 * a large JWT exceeds that, so chunk it rather than trust the platform.
 * (`auth-storage.web.ts` covers the web bundle; expo-secure-store has no web
 * implementation and the static render would crash on import-time use.)
 *
 * A chunked write must be atomic, or a refresh interrupted by the OS (Android
 * kills a backgrounded app mid-write) leaves a header beside half-replaced
 * chunks, and the next launch signs her out. So a write never touches the
 * live chunks: it lands under a fresh generation, and only the final header
 * swap makes it live. Every read sees the previous whole session or the new
 * one. A single SecureStore value is all-or-nothing (Android commits each key
 * synchronously).
 * src: node_modules/expo-secure-store/android/src/main/java/expo/modules/securestore/SecureStoreModule.kt (`commit()`) · expo-secure-store 57.0.4
 *
 * Supabase documents a `LargeSecureStore` alternative (an AES key in
 * SecureStore, the ciphertext in AsyncStorage). It needs `aes-js` and
 * `react-native-get-random-values`, puts the token in AsyncStorage (AGENTS.md
 * §7), and writes its two halves non-atomically too, so it is not used.
 * src: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native · supabase-js v2 · 2026-10-07
 */
const CHUNK_SIZE = 1800;

/** `__chunks2__:<generation>:<count>:<length>`, chunks at `<key>.<generation>.<i>`. */
const CHUNK_PREFIX = "__chunks2__:";
/**
 * The format written before 2026-10: `__chunks__:<count>`, chunks at
 * `<key>.<i>`, overwritten in place. Still read so the upgrade itself signs
 * nobody out; never written again.
 */
const LEGACY_CHUNK_PREFIX = "__chunks__:";
/** A real session is a few chunks. Anything far beyond is a corrupt header. */
const MAX_CHUNKS = 64;

type ChunkHeader = { keys: (key: string) => string[]; length: number | null };

function isChunkHeader(value: string): boolean {
  return value.startsWith(CHUNK_PREFIX) || value.startsWith(LEGACY_CHUNK_PREFIX);
}

function isChunkCount(count: number): boolean {
  return Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS;
}

function chunkKeys(key: string, generation: string | null, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    generation === null ? `${key}.${i}` : `${key}.${generation}.${i}`,
  );
}

/**
 * Reads a header value. `null` when it is not a header (a plain value);
 * `"corrupt"` when it claims to be one but cannot be followed.
 */
function parseHeader(head: string): ChunkHeader | "corrupt" | null {
  if (head.startsWith(CHUNK_PREFIX)) {
    const [generation, count, length] = head.slice(CHUNK_PREFIX.length).split(":");
    const chunkCount = Number(count);
    const totalLength = Number(length);
    if (!/^g\w+$/.test(generation ?? "") || !isChunkCount(chunkCount)) return "corrupt";
    if (!Number.isInteger(totalLength)) return "corrupt";
    return { keys: (key) => chunkKeys(key, generation, chunkCount), length: totalLength };
  }
  if (head.startsWith(LEGACY_CHUNK_PREFIX)) {
    const chunkCount = Number(head.slice(LEGACY_CHUNK_PREFIX.length));
    if (!isChunkCount(chunkCount)) return "corrupt";
    return { keys: (key) => chunkKeys(key, null, chunkCount), length: null };
  }
  return null;
}

/**
 * Splits at CHUNK_SIZE UTF-16 units, but never between the two halves of a
 * surrogate pair: half an emoji is not valid UTF-16, and the platform store
 * would replace it on the way to disk.
 */
function split(value: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + CHUNK_SIZE, value.length);
    const last = value.charCodeAt(end - 1);
    if (end < value.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks;
}

let generationCounter = 0;

/**
 * Unique per write. SecureStore keys allow only `[A-Za-z0-9._-]`; the leading
 * `g` keeps a generation from ever looking like a legacy chunk index.
 */
function nextGeneration(): string {
  generationCounter += 1;
  return `g${Date.now().toString(36)}${generationCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Best effort: the header swap (or removal) already decided what is live, so
 * a chunk that fails to delete is an orphan, never a corrupt session.
 */
async function deleteChunks(key: string, head: string | null): Promise<void> {
  const header = head === null ? null : parseHeader(head);
  if (header === null || header === "corrupt") return;
  await Promise.allSettled(header.keys(key).map((k) => SecureStore.deleteItemAsync(k)));
}

async function read(key: string): Promise<string | null> {
  const head = await SecureStore.getItemAsync(key);
  if (head === null) return null;
  const header = parseHeader(head);
  if (header === null) return head;
  if (header === "corrupt") return null;

  const parts = await Promise.all(header.keys(key).map((k) => SecureStore.getItemAsync(k)));
  if (parts.some((p) => p === null)) {
    // Only a legacy in-place write can leave a header naming chunks that never
    // landed. Read it as absent, not as a truncated token.
    return null;
  }
  const value = parts.join("");
  return header.length === null || value.length === header.length ? value : null;
}

/**
 * The current header, read only so its chunks can be cleaned up afterwards.
 * An entry that cannot be read (an Android keystore value that fails to
 * decrypt) must not block the write or removal that replaces it, or every
 * later sign-in fails to save. Skipping the clean-up leaves at worst an orphan.
 */
async function currentHeader(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  const small = value.length <= CHUNK_SIZE && !isChunkHeader(value);
  const chunks = small ? [] : split(value);
  if (chunks.length > MAX_CHUNKS) {
    // A header naming more chunks than `parseHeader` accepts would read back
    // as absent: a session that saves and then silently signs her out. Refuse
    // it before anything is touched, so the stored session survives.
    throw new Error("Session is too large to store securely.");
  }

  const previous = await currentHeader(key);

  if (small) {
    // One value replaces the header key outright: already atomic.
    await SecureStore.setItemAsync(key, value);
  } else {
    const generation = nextGeneration();
    const keys = chunkKeys(key, generation, chunks.length);
    const written = await Promise.allSettled(
      chunks.map((chunk, i) => SecureStore.setItemAsync(keys[i], chunk)),
    );
    const failure = written.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failure) {
      // The live header still names the previous generation; sweep this one.
      await Promise.allSettled(keys.map((k) => SecureStore.deleteItemAsync(k)));
      throw failure.reason;
    }
    try {
      await SecureStore.setItemAsync(
        key,
        `${CHUNK_PREFIX}${generation}:${chunks.length}:${value.length}`,
      );
    } catch (error) {
      await Promise.allSettled(keys.map((k) => SecureStore.deleteItemAsync(k)));
      throw error;
    }
  }

  await deleteChunks(key, previous);
}

async function remove(key: string): Promise<void> {
  const previous = await currentHeader(key);
  // Header first: the session is gone the moment it is, whatever the chunks do.
  await SecureStore.deleteItemAsync(key);
  await deleteChunks(key, previous);
}

/**
 * A readers-writer lane per key. A write (or removal) starts only once every
 * earlier call on the key has settled, so writes land in the order auth-js
 * made them and never sweep a generation a read is still following. A read
 * waits only for the writes issued before it, so it returns the newest value
 * (read-your-writes), while reads run alongside each other: every API request
 * reads the session, and they must not queue behind one another. This does in
 * the adapter what the deprecated auth-js `lock` option used to do around
 * every auth call — see `client.ts`.
 */
type Lane = { writes: Promise<void>; all: Promise<void> };
const lanes = new Map<string, Lane>();

const settle = (promise: Promise<unknown>): Promise<void> =>
  promise.then(
    () => undefined,
    () => undefined,
  );

function inLane<T>(key: string, kind: "read" | "write", task: () => Promise<T>): Promise<T> {
  const lane = lanes.get(key) ?? { writes: Promise.resolve(), all: Promise.resolve() };
  const run = (kind === "read" ? lane.writes : lane.all).then(task);
  const done = settle(run);
  const next: Lane =
    kind === "read"
      ? { writes: lane.writes, all: Promise.all([lane.all, done]).then(() => undefined) }
      : { writes: done, all: done };
  lanes.set(key, next);
  void next.all.then(() => {
    if (lanes.get(key) === next) lanes.delete(key);
  });
  return run;
}

export const supabaseStorage = {
  getItem: (key: string) => inLane(key, "read", () => read(key)),
  setItem: (key: string, value: string) => inLane(key, "write", () => write(key, value)),
  removeItem: (key: string) => inLane(key, "write", () => remove(key)),
};
