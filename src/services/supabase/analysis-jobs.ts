import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "expo-crypto";

import { supabase } from "./client";
import { isSchemaNotReady } from "./saved-products";
import type { Database, Json } from "./types";

/**
 * Colour read, Today's check-in and body scan jobs (R7). Every such read is
 * recorded server-side before it runs and its result stored before she is
 * answered, so a read that finished while the app was away is still hers when
 * she comes back.
 *
 * Direct through RLS (§7): members SELECT their own rows; every write is the
 * server's. The table may not be applied yet, so a missing table is a **state**
 * (`unavailable`), never an error. A photo is never in a job row, and the
 * `input` column is never selected here.
 *
 * The table is described locally on top of the generated schema, the same way
 * `generation-jobs.ts` does it, and this file does not import that one.
 */

export type AnalysisJobKind = "color_read" | "check_in" | "body_scan";
export type AnalysisJobStatus = "running" | "succeeded" | "failed";
/** Server-written; displayed ("your credit is back"), never computed with (§7). */
export type AnalysisCreditState = "none" | "charged" | "refunded";

export type AnalysisJob = {
  id: string;
  kind: AnalysisJobKind;
  client_request_id: string;
  status: AnalysisJobStatus;
  credit_state: AnalysisCreditState;
  result: Json | null;
  error_code: string | null;
  deadline_at: string;
  created_at: string;
  completed_at: string | null;
};

export type LatestAnalysisJob = { status: "ok"; job: AnalysisJob | null } | { status: "unavailable" };

/** Every column but `input`, which holds a digest of the photos and is not hers to render. */
export const ANALYSIS_JOB_COLUMNS = [
  "id",
  "kind",
  "client_request_id",
  "status",
  "credit_state",
  "result",
  "error_code",
  "deadline_at",
  "created_at",
  "completed_at",
].join(",");

type AnalysisJobsTable = {
  Row: AnalysisJob & { user_id: string; input: Json };
  Insert: never;
  Update: never;
  Relationships: [];
};
type DatabaseWithAnalysisJobs = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & { generation_jobs: AnalysisJobsTable };
  };
};
const db = supabase as unknown as SupabaseClient<DatabaseWithAnalysisJobs>;

/**
 * The idempotency key for one press. The server charges a key once and replays
 * its result for a repeat, so a double press or a lost answer never pays twice.
 */
// src: https://docs.expo.dev/versions/v57.0.0/sdk/crypto/ randomUUID(): string (UUID v4) · expo-crypto 57.0.3
export function newClientRequestId(): string {
  return randomUUID();
}

const KINDS: ReadonlySet<string> = new Set<AnalysisJobKind>(["color_read", "check_in", "body_scan"]);
const STATUSES: ReadonlySet<string> = new Set<AnalysisJobStatus>(["running", "succeeded", "failed"]);
const CREDIT_STATES: ReadonlySet<string> = new Set<AnalysisCreditState>([
  "none",
  "charged",
  "refunded",
]);

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** A row this build cannot read is skipped, never guessed at. */
export function parseAnalysisJob(raw: unknown): AnalysisJob | null {
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
  return {
    id,
    kind: kind as AnalysisJobKind,
    client_request_id: clientRequestId,
    status: status as AnalysisJobStatus,
    credit_state:
      creditState && CREDIT_STATES.has(creditState) ? (creditState as AnalysisCreditState) : "none",
    result: (row.result ?? null) as Json | null,
    error_code: text(row.error_code),
    deadline_at: deadlineAt,
    created_at: createdAt,
    completed_at: text(row.completed_at),
  };
}

/** Her newest job of one kind, through the (user_id, kind, created_at desc) index. */
export async function fetchLatestAnalysisJob(
  userId: string,
  kind: AnalysisJobKind,
): Promise<LatestAnalysisJob> {
  const { data, error } = await db
    .from("generation_jobs")
    .select(ANALYSIS_JOB_COLUMNS)
    .eq("user_id", userId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1);

  if (isSchemaNotReady(error)) return { status: "unavailable" };
  if (error) throw error;

  const rows: unknown[] = Array.isArray(data) ? data : [];
  const job = rows.length > 0 ? parseAnalysisJob(rows[0]) : null;
  return { status: "ok", job: job && job.kind === kind ? job : null };
}
