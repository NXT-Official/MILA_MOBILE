import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "expo-crypto";

import { supabase } from "./client";
import { isSchemaNotReady } from "./saved-products";
import type { Database, Json } from "./types";

/**
 * Generation jobs (R7): every paid generation is recorded server-side before it
 * runs, and its result is stored before the member is answered. When the app is
 * backgrounded, remounted or restarted mid-generation, Home reads her latest
 * job rows here and re-attaches instead of losing what she paid for.
 *
 * Direct through RLS (§7): members SELECT their own rows; every write is the
 * server's. The table ships in a web migration that may not be applied yet, so
 * a missing table is a **state** (`unavailable`), never an error, and Home
 * keeps today's behaviour until it exists.
 */

/** The kinds Home starts. The server records more; mobile reads only these. */
export type GenerationJobKind = "look" | "style_sheet" | "photo_preview";
export type GenerationJobStatus = "running" | "succeeded" | "failed";
/** Server-written; displayed ("your credit is back"), never computed with (§7). */
export type GenerationCreditState = "none" | "charged" | "refunded";

/**
 * One job row, in the server's own field names (the same convention as every
 * other row type here). `result` holds the look JSON for a look; for a render
 * it only names its mode, and the image lives at `image_path`.
 */
export type GenerationJob = {
  id: string;
  kind: GenerationJobKind;
  client_request_id: string;
  status: GenerationJobStatus;
  credit_state: GenerationCreditState;
  result: Json | null;
  image_path: string | null;
  error_code: string | null;
  deadline_at: string;
  created_at: string;
  completed_at: string | null;
  /** A style sheet or portrait: the look it was drawn for (its request's look). */
  for_look: { headline: string; description: string } | null;
  /** A look: the vibe and weather it was asked for, which is what it is saved under. */
  look_input: { vibe: string | null; weather: string | null } | null;
};

export type LatestGenerationJob = { status: "ok"; job: GenerationJob | null } | { status: "unavailable" };

/**
 * The whole `input` is never read (a render's input is the whole look). Only
 * named fields of it are, as PostgREST JSON paths: which look a render was
 * drawn for (matched by headline and description, as the web does), and the
 * vibe and weather a look was asked for. `credit_state` is read to say "your
 * credit is back", never to compute a balance (§7).
 */
// src: https://docs.postgrest.org/en/v12/references/api/tables_views.html#json-columns
//   (`alias:column->key->>key` selects one field as text) · PostgREST 12
export const GENERATION_JOB_COLUMNS = [
  "id",
  "kind",
  "client_request_id",
  "status",
  "credit_state",
  "result",
  "image_path",
  "error_code",
  "deadline_at",
  "created_at",
  "completed_at",
  "look_vibe:input->>vibe",
  "look_weather:input->>weather",
  "for_headline:input->outfit->outfit->>headline",
  "for_description:input->outfit->outfit->>description",
].join(",");

const GENERATIONS_BUCKET = "generations";
/** Long enough for one download, short enough to be useless if it leaked. */
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * React Native's fetch sets no timeout, so every read here carries its own
 * deadline: a hung read must fail (and let the screen offer its retry), never
 * hold "composing" or a disabled Create until the app restarts.
 */
export const GENERATION_READ_TIMEOUT_MS = 10_000;
/** An image is larger, and is read once: a longer deadline. */
export const GENERATION_IMAGE_TIMEOUT_MS = 30_000;

/**
 * A signal that aborts after `ms`, or as soon as `outer` (the query's own
 * signal: TanStack aborts it when a read is cancelled) does. `done` clears
 * the timer and the listener.
 */
function deadline(ms: number, outer?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const forward = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", forward);
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", forward);
    },
  };
}

/**
 * The generated types are a copy of the web's and predate this table. Until
 * they are regenerated against a database that has it, this one table is
 * described here, on top of the generated schema, so the query stays typed.
 */
type GenerationJobsTable = {
  Row: Omit<GenerationJob, "for_look" | "look_input"> & { user_id: string; input: Json };
  Insert: never;
  Update: never;
  Relationships: [];
};
type DatabaseWithGenerationJobs = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & { generation_jobs: GenerationJobsTable };
  };
};
const db = supabase as unknown as SupabaseClient<DatabaseWithGenerationJobs>;

/**
 * The idempotency key for one press. The server charges a key once and replays
 * its result for a repeat, so a double press or a lost answer never pays twice.
 */
// src: https://docs.expo.dev/versions/v57.0.0/sdk/crypto/ randomUUID(): string (UUID v4) · expo-crypto 57.0.3
export function newClientRequestId(): string {
  return randomUUID();
}

const KINDS: ReadonlySet<string> = new Set<GenerationJobKind>(["look", "style_sheet", "photo_preview"]);
const STATUSES: ReadonlySet<string> = new Set<GenerationJobStatus>(["running", "succeeded", "failed"]);
const CREDIT_STATES: ReadonlySet<string> = new Set<GenerationCreditState>([
  "none",
  "charged",
  "refunded",
]);

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** A row this build cannot read is skipped, never guessed at. */
export function parseGenerationJob(raw: unknown): GenerationJob | null {
  if (raw === null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = text(row.id);
  const kind = text(row.kind);
  const status = text(row.status);
  const clientRequestId = text(row.client_request_id);
  const deadlineAt = text(row.deadline_at);
  const createdAt = text(row.created_at);
  if (!id || !clientRequestId || !deadlineAt || !createdAt) return null;
  if (!kind || !KINDS.has(kind) || !status || !STATUSES.has(status)) return null;

  const creditState = text(row.credit_state);
  const forHeadline = text(row.for_headline);
  const forDescription = text(row.for_description);

  return {
    id,
    kind: kind as GenerationJobKind,
    client_request_id: clientRequestId,
    status: status as GenerationJobStatus,
    credit_state:
      creditState && CREDIT_STATES.has(creditState) ? (creditState as GenerationCreditState) : "none",
    result: (row.result ?? null) as Json | null,
    image_path: text(row.image_path),
    error_code: text(row.error_code),
    deadline_at: deadlineAt,
    created_at: createdAt,
    completed_at: text(row.completed_at),
    for_look:
      kind !== "look" && forHeadline && forDescription
        ? { headline: forHeadline, description: forDescription }
        : null,
    look_input:
      kind === "look" ? { vibe: text(row.look_vibe), weather: text(row.look_weather) } : null,
  };
}

/** The first row of a read, checked, or the state the read means. */
function firstJob(
  data: unknown,
  error: { code?: string | null } | null,
  kind: GenerationJobKind,
): LatestGenerationJob {
  if (isSchemaNotReady(error)) return { status: "unavailable" };
  // A refused or aborted read throws, so the last good rows stay on screen
  // and the query's own retry runs.
  if (error) throw error;
  const rows: unknown[] = Array.isArray(data) ? data : [];
  const job = rows.length > 0 ? parseGenerationJob(rows[0]) : null;
  return { status: "ok", job: job && job.kind === kind ? job : null };
}

/**
 * Her newest job of one kind, through the (user_id, kind, created_at desc)
 * index. `signal`: the query's own, so a cancelled read stops at once.
 */
// src: node_modules/@supabase/postgrest-js/dist/index.d.cts `abortSignal(signal: AbortSignal): this` · 2.112.2
//   (the same call and pin as services/supabase/profile.ts `fetchProfile`); an aborted
//   request is reported as `{ error }`, which is thrown like any other failure.
export async function fetchLatestGenerationJob(
  userId: string,
  kind: GenerationJobKind,
  signal?: AbortSignal,
): Promise<LatestGenerationJob> {
  const bound = deadline(GENERATION_READ_TIMEOUT_MS, signal);
  try {
    const { data, error } = await db
      .from("generation_jobs")
      .select(GENERATION_JOB_COLUMNS)
      .eq("user_id", userId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(1)
      .abortSignal(bound.signal);
    return firstJob(data, error, kind);
  } finally {
    bound.done();
  }
}

/**
 * Her one row for a press key (the key is unique per member), within the same
 * deadline. Asked before a press that would otherwise mint a new key over an
 * old unanswered one: if that job still runs or finished, the old key is sent
 * again (one charge); if it failed or never arrived, a new key is minted.
 */
export async function fetchGenerationJobByRequest(
  userId: string,
  kind: GenerationJobKind,
  clientRequestId: string,
  signal?: AbortSignal,
): Promise<LatestGenerationJob> {
  const bound = deadline(GENERATION_READ_TIMEOUT_MS, signal);
  try {
    const { data, error } = await db
      .from("generation_jobs")
      .select(GENERATION_JOB_COLUMNS)
      .eq("user_id", userId)
      .eq("kind", kind)
      .eq("client_request_id", clientRequestId)
      .limit(1)
      .abortSignal(bound.signal);
    return firstJob(data, error, kind);
  } finally {
    bound.done();
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function mimeFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "image/jpeg";
}

// src: https://github.com/facebook/react-native/blob/0.86-stable/packages/react-native/Libraries/Blob/FileReader.js
//   readAsDataURL(blob) is implemented natively (NativeFileReaderModule) · react-native 0.86
function readAsDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The image could not be read."));
    };
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

/**
 * A succeeded render's image, as the same base64 `data:` URI the render route
 * answers with, so showing, saving and downloading it need nothing new.
 *
 * Only a succeeded row's own `image_path` is ever signed. Her folder is never
 * listed: an object can exist there for a job that was later failed and
 * refunded, and that image is not hers to be shown as a result.
 */
export async function fetchGenerationImage(job: GenerationJob, signal?: AbortSignal): Promise<string> {
  if (job.status !== "succeeded" || !job.image_path) {
    throw new Error("Only a finished generation has an image to show.");
  }
  const bound = deadline(GENERATION_IMAGE_TIMEOUT_MS, signal);
  // Signing cannot be aborted; the race lets the deadline end the read anyway.
  const timedOut = new Promise<never>((_resolve, reject) => {
    const fail = () => reject(new Error("The image took too long to load."));
    if (bound.signal.aborted) fail();
    else bound.signal.addEventListener("abort", fail);
  });
  try {
    return await Promise.race([readImage(job.image_path, bound.signal), timedOut]);
  } finally {
    bound.done();
  }
}

async function readImage(path: string, signal: AbortSignal): Promise<string> {
  // src: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
  //   createSignedUrl(path, expiresIn) → { data: { signedUrl }, error } · storage-js 2.112.2
  const { data, error } = await supabase.storage
    .from(GENERATIONS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error("The image could not be loaded.");

  const response = await fetch(data.signedUrl, { signal });
  if (!response.ok) throw new Error("The image could not be loaded.");

  const blob = await response.blob();
  let dataUri: string;
  try {
    dataUri = await readAsDataUri(blob);
  } finally {
    // React Native's Blob holds native memory until it is closed.
    // src: https://github.com/facebook/react-native/blob/0.86-stable/packages/react-native/Libraries/Blob/Blob.js
    //   close(): releases the blob's native data · react-native 0.86
    (blob as Blob & { close?: () => void }).close?.();
  }
  const comma = dataUri.indexOf(",");
  if (!dataUri.startsWith("data:") || comma === -1) {
    throw new Error("The image could not be read.");
  }
  // The native reader names the blob's own type, which a storage response can
  // leave empty or generic; the path's extension is what the server uploaded
  // it as, so it wins unless the response already says which image this is.
  const declared = dataUri.slice(5, comma).split(";")[0];
  const mime = declared.startsWith("image/") ? declared : mimeFromPath(path);
  return `data:${mime};base64,${dataUri.slice(comma + 1)}`;
}
