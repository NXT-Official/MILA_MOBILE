import type { GenerationJob } from "@/services/supabase/generation-jobs";
import type { Json } from "@/services/supabase/types";
import type { DailyLook } from "@/types/look";

/**
 * What Home shows from a generation job it did not watch finish (R7): after a
 * background, a remount or a restart, her latest job rows say what happened to
 * the look and the visuals she paid for. Pure, so every rule is testable
 * without a screen. The rules are the web's (`src/lib/queries/generation-jobs.ts`):
 *
 * - Her own unanswered press always lands.
 * - Otherwise her latest finished look comes back only when nothing is on
 *   screen, she has not saved it, and it finished today or within 12 hours.
 * - A look already on screen is never swapped for another job's look.
 * - A style sheet or portrait belongs to exactly one look: the one it was drawn
 *   for (headline and description of its request's look).
 */

/** One press on this screen: the key it sent, and the job the server named if
 * it answered "running" (another request of the same look was in flight). */
export type GenerationAction = { clientRequestId: string; followJobId?: string | null };

/** The server reaps a running job 30 s after its deadline. */
const REAP_GRACE_MS = 30_000;
/** The phone's clock and the database's can disagree by this much. */
const CLOCK_SKEW_MS = 15_000;
/** A finished look older than this (and not from today) is history, not today's look. */
export const RECOVERY_WINDOW_MS = 12 * 60 * 60_000;

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

type LookLike = { outfit: { headline: string; description: string } };

/** A look's identity for its visuals: what a render's request names as its look. */
export function lookKeyOf(look: LookLike): string {
  return `${look.outfit.headline}\n${look.outfit.description}`;
}

/** Whether a style sheet or portrait row was drawn for this look. */
export function jobIsForLook(job: GenerationJob | null | undefined, look: LookLike | null | undefined): boolean {
  if (!job?.for_look || !look) return false;
  return (
    job.for_look.headline === look.outfit.headline &&
    job.for_look.description === look.outfit.description
  );
}

/** When a look finished, by the server's timestamps (its start when it has no finish). */
function finishedAtOf(job: GenerationJob): number {
  return Date.parse(job.completed_at ?? job.created_at);
}

/**
 * The shared recovery window: a look that finished today (her local day) or
 * within the last 12 hours. Keyed on when it FINISHED, so a look started at
 * 23:58 and finished at 00:02 is today's, and last night's 23:40 look is still
 * there at 07:40.
 */
export function isRecentLook(job: GenerationJob, nowMs: number): boolean {
  const finished = finishedAtOf(job);
  if (Number.isNaN(finished)) return false;
  if (nowMs - finished <= RECOVERY_WINDOW_MS) return true;
  return new Date(finished).toDateString() === new Date(nowMs).toDateString();
}

function clockTime(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

/**
 * A recovered look from before today says when it is from, in place of today's
 * weather (the window keeps it to the previous day). Null for a look from today.
 */
export function recoveredLookLabel(finishedAtMs: number, nowMs: number): string | null {
  const finished = new Date(finishedAtMs);
  if (Number.isNaN(finishedAtMs) || finished.toDateString() === new Date(nowMs).toDateString()) {
    return null;
  }
  return finished.getHours() >= 18
    ? `From last night, ${clockTime(finishedAtMs)}`
    : `From yesterday, ${clockTime(finishedAtMs)}`;
}

/** A look to put back on screen, with what it is saved under. */
export type RecoveredLook = {
  look: DailyLook;
  jobId: string;
  /** The key the job was started with. */
  requestId: string;
  /** Her own press (its key is one this phone sent): it continues to its free style sheet. */
  own: boolean;
  finishedAt: number;
  /** The vibe and weather it was asked for (the weather as the request sent it). */
  vibe: string | null;
  weather: string | null;
};

type RecoveryInput = {
  job: GenerationJob | null;
  /** The job of the look on screen, when it came from one. */
  shownJobId: string | null;
  hasLookOnScreen: boolean;
  /** Keys of her own unanswered look presses (this phone's ledger). */
  ownIds: readonly string[];
  /** The job the server told her press here to follow. */
  followJobId: string | null;
  /** A press on this screen is unresolved (failed, or answered "running"). */
  pressedHere: boolean;
  /** This look is already in her History. */
  saved: boolean;
  nowMs: number;
};

/**
 * The look to put back on screen, or null.
 * - Her own unanswered press (or the job her press was told to follow) always lands.
 * - Otherwise only when nothing is on screen, no press of hers here is
 *   unresolved (an older look never stands in for it), she has not saved it,
 *   and it is recent.
 * - A look already on screen is never swapped.
 */
export function lookToRecover(input: RecoveryInput): RecoveredLook | null {
  const { job, shownJobId, ownIds, followJobId, nowMs } = input;
  if (!job || job.kind !== "look" || job.status !== "succeeded") return null;
  if (shownJobId === job.id) return null;
  const look = parseStoredLook(job.result);
  if (!look) return null;

  const decision: RecoveredLook = {
    look,
    jobId: job.id,
    requestId: job.client_request_id,
    own: ownIds.includes(job.client_request_id),
    finishedAt: finishedAtOf(job),
    vibe: job.look_input?.vibe ?? null,
    weather: job.look_input?.weather ?? null,
  };
  if (decision.own || job.id === followJobId) return decision;
  if (input.hasLookOnScreen || input.pressedHere || input.saved) return null;
  return isRecentLook(job, nowMs) ? decision : null;
}

/**
 * A look still being made, to show as composing (and to block a second paid
 * press). Her own job, or the one her press follows, always; a job from
 * elsewhere only on an empty screen with no press of hers here.
 */
export function lookInProgress(input: {
  job: GenerationJob | null;
  ownIds: readonly string[];
  followJobId: string | null;
  pressedHere: boolean;
  hasLookOnScreen: boolean;
  nowMs: number;
}): { composing: boolean; own: boolean } {
  const { job } = input;
  if (!job || job.kind !== "look" || !isLiveRunning(job, input.nowMs)) {
    return { composing: false, own: false };
  }
  if (input.ownIds.includes(job.client_request_id)) return { composing: true, own: true };
  if (job.id === input.followJobId) return { composing: true, own: false };
  if (input.pressedHere || input.hasLookOnScreen) return { composing: false, own: false };
  return { composing: true, own: false };
}

export type LookRecovery = {
  composing: boolean;
  /** The composing job is her own press: the phone stays awake for it. */
  ownComposing: boolean;
  candidate: RecoveredLook | null;
};

/** Everything Home needs from her latest look job, in one call. */
export function recoverLook(input: RecoveryInput): LookRecovery {
  const progress = lookInProgress(input);
  return {
    composing: progress.composing,
    ownComposing: progress.composing && progress.own,
    candidate: lookToRecover(input),
  };
}

/**
 * What to tell her when HER OWN look job turned out to have failed: whether her
 * credit is back is read from the row (display, not accounting, §7). Silent for
 * a delivered-but-unsaved job (charged and handed over: never a failure, N7).
 */
export function failureNotice(job: GenerationJob): string | null {
  if (job.status !== "failed" || job.error_code === "persist_failed_delivered") return null;
  return job.credit_state === "refunded"
    ? "Mila couldn't finish your look. Your credit is back."
    : "Mila couldn't finish your look. Please try again.";
}

/** A History row, as `useOutfits` reads it. */
type SavedRow = { analysis_result: Json | null; created_at: string };

/**
 * Whether she already saved this look: a History row with its headline, saved
 * since the job started. A saved look is never brought back (saving it again
 * would duplicate it).
 */
export function lookAlreadySaved(
  rows: readonly SavedRow[] | undefined,
  job: GenerationJob,
  look: LookLike,
): boolean {
  const since = Date.parse(job.created_at);
  return (rows ?? []).some((row) => {
    const outfit = isRecord(row.analysis_result) ? row.analysis_result.outfit : null;
    return (
      isRecord(outfit) &&
      outfit.headline === look.outfit.headline &&
      Date.parse(row.created_at) >= since
    );
  });
}

const REQUEST_WEATHER = /^(.*) \(in (.*)\)$/;

/** "24°C Sunny (in Manila)", as the request sent it, to the badge's "24°C Sunny". */
export function weatherBadgeOf(weather: string | null): string | null {
  if (!weather) return null;
  return REQUEST_WEATHER.exec(weather)?.[1] ?? weather;
}

/** The request's weather, as History saves it: "24°C Sunny (Manila)". */
export function savedWeatherOf(weather: string): string {
  const match = REQUEST_WEATHER.exec(weather);
  return match ? `${match[1]} (${match[2]})` : weather;
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
 * A style sheet or portrait for the look on screen. With a press on this screen
 * (always for this look: presses are cleared with every new look), only that
 * press's job counts. With none, only a render drawn for this look counts.
 */
export function recoverVisual({
  job,
  action,
  look,
  nowMs,
}: {
  job: GenerationJob | null;
  action: GenerationAction | null;
  look: LookLike | null;
  nowMs: number;
}): VisualRecovery {
  if (!job || !look || !jobIsForLook(job, look)) return NO_VISUAL;
  if (action && !belongsTo(job, action)) return NO_VISUAL;

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

/**
 * No style sheet attempt to report for this look: none was started for it, or
 * one was delivered elsewhere and not kept (never a failure, N7). Then the
 * sheet is offered as not drawn yet, without a credit claim: the look's own
 * free first visual is still waiting.
 */
export function sheetNeverDrawn(job: GenerationJob | null, look: LookLike): boolean {
  if (!job || !jobIsForLook(job, look)) return true;
  return job.status === "failed" && job.error_code === "persist_failed_delivered";
}
