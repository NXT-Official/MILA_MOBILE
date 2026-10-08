import type { ClimateCondition } from "@/constants/climate";
import type { Vibe } from "@/constants/vibes";
import type { DailyLook } from "@/types/look";

import { api, TIMEOUTS } from "./client";
import { ApiError } from "./errors";

export type { DailyLook } from "@/types/look";

/**
 * The daily look pipeline. Three calls, and the **order is the billing**:
 *
 *   /look/generate      charges 1 credit and sets `look_image_pending`
 *   /look/style-sheet   claims that flag, so the first visual is free
 *   /look/photo-preview same claim — the optional portrait edit
 *   saveDailyLook       free, and direct through RLS — see services/supabase/outfits
 *
 * Do not reorder them and do not merge them (§6). Prompts, Zod schemas, rate
 * limits, and refund predicates are server-side and shared with the web — this
 * file sends typed input and receives typed output, and holds no model name, no
 * provider, and no prompt text.
 */

export type GenerateLookInput = {
  bodyType: string;
  colorSeason: string;
  skinUndertone?: string;
  faceShape?: string;
  hairType?: string;
  weather: string;
  tempF?: number;
  tempC?: number;
  condition?: ClimateCondition;
  location?: string;
  lat?: number;
  lon?: number;
  vibe: Vibe;
  /**
   * When present, more specific than the vibe and takes priority for
   * occasion-appropriateness server-side. The web sends all three only when
   * the member filled them in.
   */
  agenda?: string;
  dressCode?: string;
  indoorOutdoor?: "Indoor" | "Outdoor" | "Mixed";
  /** IANA zone, e.g. `Asia/Manila` — lets the server reason about "today". */
  timezone?: string;
  /** ISO 3166-1 alpha-2 from the profile's delivery country; omitted when unknown. */
  region?: string;
};

/**
 * The server is still working on this generation (R7). Answered to a request
 * that carries a `clientRequestId` when that request's job, or the same
 * request from another device, is already running: nothing was charged for
 * this call, and the caller follows the job's row until it settles.
 */
export type GenerationRunning = { status: "running"; jobId: string };

export function isGenerationRunning(value: unknown): value is GenerationRunning {
  if (value === null || typeof value !== "object") return false;
  const answer = value as { status?: unknown; jobId?: unknown };
  return answer.status === "running" && typeof answer.jobId === "string";
}

/**
 * The call ended without an answer about her job: a client timeout, a proxy
 * timeout, a dropped connection, a gateway's non-JSON 5xx (the client reads it
 * as INTERNAL with that status), our own unexpected 500, or a 401 while her
 * token was being refreshed. The job may still be running or may have
 * finished, so the press KEEPS its key: resending it replays, follows or starts
 * that job, never a second charge (the server dedupes the key). Any other
 * answer from our server, even an error, spends the key; so does her job row
 * saying it failed.
 */
export function isLostAnswer(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === "NETWORK" || error.code === "TIMEOUT") return true;
  if (error.status === 401) return true;
  return error.code === "INTERNAL" && error.status >= 500;
}

/** Today's look, plus the generation job it was recorded as (absent until the
 * server's generation_jobs migration is applied, null when it was delivered
 * without being stored). */
export type LookResponse = DailyLook & {
  jobId?: string | null;
  /** Set by a server that says the answer replays a job it already made. */
  replayed?: boolean;
};

/**
 * `clientRequestId` is the press's idempotency key (one per press, never per
 * attempt): the server charges a key once and replays its stored result for a
 * repeat. Optional, so the body is exactly today's without one.
 */
function withRequestId<T extends object>(body: T, clientRequestId?: string) {
  return clientRequestId ? { ...body, clientRequestId } : body;
}

export function generateDailyLook(
  input: GenerateLookInput,
  clientRequestId?: string,
): Promise<LookResponse | GenerationRunning> {
  return api.post<LookResponse | GenerationRunning>(
    "/look/generate",
    withRequestId(input, clientRequestId),
    { timeoutMs: TIMEOUTS.generateLook },
  );
}

/**
 * The identity-locked 5-view style sheet — the primary visual, rendered from
 * the member's consented selfie. `mode: "unavailable"` covers both "no
 * consented photo on file" and a failed QA check: both are a **successful
 * response** the caller answers with copy and a retry, never an exception.
 */
export type StyleSheetResult =
  | { imageDataUri: string; mode: "style_sheet" }
  | { imageDataUri: null; mode: "unavailable"; reason: string };

export function generateStyleSheetPreview(
  outfit: DailyLook,
  clientRequestId?: string,
): Promise<StyleSheetResult | GenerationRunning> {
  return api.post<StyleSheetResult | GenerationRunning>(
    "/look/style-sheet",
    withRequestId({ outfit }, clientRequestId),
    { timeoutMs: TIMEOUTS.lookVisual },
  );
}

/**
 * The single-photo edit preview — the member's own selfie with the outfit
 * composited on. The optional secondary visual beside the style sheet. Same
 * partial-result contract as the style sheet.
 */
export type PhotoPreviewResult =
  | { imageDataUri: string; mode: "photo_edit" }
  | { imageDataUri: null; mode: "unavailable"; reason: string };

export function generatePhotoPreview(
  outfit: DailyLook,
  clientRequestId?: string,
): Promise<PhotoPreviewResult | GenerationRunning> {
  return api.post<PhotoPreviewResult | GenerationRunning>(
    "/look/photo-preview",
    withRequestId({ outfit }, clientRequestId),
    { timeoutMs: TIMEOUTS.lookVisual },
  );
}

export type SaveLookInput = DailyLook & {
  /** The visual to save — null/omitted when the look has none (auto-save). */
  imageDataUri?: string | null;
  weather: string;
  vibe: Vibe;
  /** Which pipeline produced the saved visual — omitted when there is none. */
  previewMode?: "style_sheet" | "photo_edit";
};
