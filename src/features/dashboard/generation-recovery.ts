import type { GenerationJob } from "@/services/supabase/generation-jobs";
import type { Json } from "@/services/supabase/types";
import type { DailyLook } from "@/types/look";

/**
 * What Home shows from a generation job it did not watch finish (R7): after a
 * background, a remount or a restart, her latest job rows say what happened to
 * the look and the visuals she paid for. Pure, so every rule is testable
 * without a screen.
 */

/** One press on this screen: the key it sent, and the job the server named if
 * it answered "running" (another request of the same look was in flight). */
export type GenerationAction = { clientRequestId: string; followJobId?: string | null };

/** The server reaps a running job 30 s after its deadline. */
const REAP_GRACE_MS = 30_000;
/** The phone's clock and the database's can disagree by this much. */
const CLOCK_SKEW_MS = 15_000;

/** Still inside its deadline, the reaper's grace and the skew allowance. */
export function isLiveRunning(job: GenerationJob, nowMs: number): boolean {
  if (job.status !== "running") return false;
  const deadline = Date.parse(job.deadline_at);
  if (Number.isNaN(deadline)) return false;
  return nowMs <= deadline + REAP_GRACE_MS + CLOCK_SKEW_MS;
}

export type JobOutcome = "running" | "succeeded" | "delivered" | "failed";

/**
 * `persist_failed_delivered`: the result reached the client that asked and
 * could not be stored, and the charge was kept. It is never a failure and
 * never a refund. A running job past its deadline and grace is dead: the
 * reaper (or her next press, which reaps first) fails it and refunds it.
 */
export function jobOutcome(job: GenerationJob, nowMs: number): JobOutcome {
  if (job.status === "running") return isLiveRunning(job, nowMs) ? "running" : "failed";
  if (job.status === "succeeded") return "succeeded";
  return job.error_code === "persist_failed_delivered" ? "delivered" : "failed";
}

export function belongsTo(job: GenerationJob, action: GenerationAction): boolean {
  return job.client_request_id === action.clientRequestId || job.id === action.followJobId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasStrings(value: unknown, keys: string[]): boolean {
  return isRecord(value) && keys.every((key) => typeof value[key] === "string");
}

/**
 * The stored look, checked for the fields Home renders. The server validated it
 * with the full schema before storing it; this only refuses a shape this build
 * could not draw.
 */
export function parseStoredLook(result: Json | null): DailyLook | null {
  if (!isRecord(result)) return null;
  if (!hasStrings(result.outfit, ["headline", "description", "styling_notes"])) return null;
  if (!hasStrings(result.hair, ["style", "execution_tip"])) return null;
  if (result.makeup !== null && !hasStrings(result.makeup, ["palette", "details"])) return null;
  if (typeof result.vibe_alignment_score !== "number") return null;
  return result as unknown as DailyLook;
}

function sameLocalDay(isoTime: string, nowMs: number): boolean {
  const time = Date.parse(isoTime);
  return !Number.isNaN(time) && new Date(time).toDateString() === new Date(nowMs).toDateString();
}

export type LookRecovery = {
  /** A look is still being composed: show progress, block a second paid press. */
  composing: boolean;
  /** A finished look to show when the screen has none of its own. */
  look: DailyLook | null;
  /** The job of the look on screen, which its visuals are matched against. */
  job: GenerationJob | null;
  /** The job is this screen's own press, not one it was told to follow. */
  ownRequest: boolean;
};

const NO_LOOK: LookRecovery = { composing: false, look: null, job: null, ownRequest: false };

/**
 * With a press on this screen, only that press's job counts: an older job must
 * never stand in for a request that failed before it reached the server. With
 * none, a running job is shown as running and today's finished look is shown;
 * a look from another day is not today's look.
 */
export function recoverLook({
  job,
  action,
  nowMs,
}: {
  job: GenerationJob | null;
  action: GenerationAction | null;
  nowMs: number;
}): LookRecovery {
  if (!job) return NO_LOOK;
  const outcome = jobOutcome(job, nowMs);

  if (action) {
    if (!belongsTo(job, action)) return NO_LOOK;
    const ownRequest = job.client_request_id === action.clientRequestId;
    if (outcome === "running") return { composing: true, look: null, job, ownRequest };
    const look = outcome === "succeeded" ? parseStoredLook(job.result) : null;
    return { composing: false, look, job, ownRequest };
  }

  if (outcome === "running") return { composing: true, look: null, job, ownRequest: false };
  if (outcome === "succeeded" && sameLocalDay(job.created_at, nowMs)) {
    const look = parseStoredLook(job.result);
    if (look) return { composing: false, look, job, ownRequest: false };
  }
  return NO_LOOK;
}

export type VisualRecovery = {
  /** The render is still running. */
  rendering: boolean;
  /** A succeeded render with an image: the only row whose image may be read. */
  succeededJob: GenerationJob | null;
  /** The render failed (and was refunded, or will be by the reaper). */
  failed: boolean;
};

export const NO_VISUAL: VisualRecovery = { rendering: false, succeededJob: null, failed: false };

/**
 * A style sheet or portrait preview. With a press on this screen, only that
 * press's job counts. With none, a render counts when it was started after the
 * look on screen was: visuals are only ever drawn for the look in front of her.
 */
export function recoverVisual({
  job,
  action,
  lookJob,
  nowMs,
}: {
  job: GenerationJob | null;
  action: GenerationAction | null;
  lookJob: GenerationJob | null;
  nowMs: number;
}): VisualRecovery {
  if (!job) return NO_VISUAL;
  if (action) {
    if (!belongsTo(job, action)) return NO_VISUAL;
  } else {
    if (!lookJob || Date.parse(job.created_at) < Date.parse(lookJob.created_at)) return NO_VISUAL;
  }

  switch (jobOutcome(job, nowMs)) {
    case "running":
      return { rendering: true, succeededJob: null, failed: false };
    case "succeeded":
      return { rendering: false, succeededJob: job.image_path ? job : null, failed: false };
    case "failed":
      return { rendering: false, succeededJob: null, failed: true };
    case "delivered":
      return NO_VISUAL;
  }
}
