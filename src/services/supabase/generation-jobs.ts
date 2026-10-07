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
  result: Json | null;
  image_path: string | null;
  error_code: string | null;
  deadline_at: string;
  created_at: string;
  completed_at: string | null;
};

export type LatestGenerationJob = { status: "ok"; job: GenerationJob | null } | { status: "unavailable" };

/**
 * `input` is deliberately absent: a render's input is the whole look, and Home
 * never needs it back. So are the credit columns: the app displays a balance,
 * it never reasons about one (§7).
 */
export const GENERATION_JOB_COLUMNS =
  "id,kind,client_request_id,status,result,image_path,error_code,deadline_at,created_at,completed_at";

const GENERATIONS_BUCKET = "generations";
/** Long enough for one download, short enough to be useless if it leaked. */
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * The generated types are a copy of the web's and predate this table. Until
 * they are regenerated against a database that has it, this one table is
 * described here, on top of the generated schema, so the query stays typed.
 */
type GenerationJobsTable = {
  Row: GenerationJob & { user_id: string };
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

  return {
    id,
    kind: kind as GenerationJobKind,
    client_request_id: clientRequestId,
    status: status as GenerationJobStatus,
    result: (row.result ?? null) as Json | null,
    image_path: text(row.image_path),
    error_code: text(row.error_code),
    deadline_at: deadlineAt,
    created_at: createdAt,
    completed_at: text(row.completed_at),
  };
}

/** Her newest job of one kind, through the (user_id, kind, created_at desc) index. */
export async function fetchLatestGenerationJob(
  userId: string,
  kind: GenerationJobKind,
): Promise<LatestGenerationJob> {
  const { data, error } = await db
    .from("generation_jobs")
    .select(GENERATION_JOB_COLUMNS)
    .eq("user_id", userId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1);

  if (isSchemaNotReady(error)) return { status: "unavailable" };
  if (error) throw error;

  const rows: unknown[] = Array.isArray(data) ? data : [];
  const job = rows.length > 0 ? parseGenerationJob(rows[0]) : null;
  return { status: "ok", job: job && job.kind === kind ? job : null };
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
export async function fetchGenerationImage(job: GenerationJob): Promise<string> {
  if (job.status !== "succeeded" || !job.image_path) {
    throw new Error("Only a finished generation has an image to show.");
  }
  const path = job.image_path;

  // src: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
  //   createSignedUrl(path, expiresIn) → { data: { signedUrl }, error } · storage-js 2.112.2
  const { data, error } = await supabase.storage
    .from(GENERATIONS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error("The image could not be loaded.");

  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error("The image could not be loaded.");

  const dataUri = await readAsDataUri(await response.blob());
  const comma = dataUri.indexOf(",");
  if (!dataUri.startsWith("data:") || comma === -1) {
    throw new Error("The image could not be read.");
  }
  // The native reader names the blob's own type, which a storage response can
  // leave empty; the path's extension is what the server uploaded it as.
  const declared = dataUri.slice(5, comma).split(";")[0];
  return `data:${declared || mimeFromPath(path)};base64,${dataUri.slice(comma + 1)}`;
}
