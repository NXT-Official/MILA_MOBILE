import type { ClimateCondition } from "@/constants/climate";
import type { Vibe } from "@/constants/vibes";
import type { DailyLook } from "@/types/look";

import { api, TIMEOUTS } from "./client";

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

export function generateDailyLook(input: GenerateLookInput): Promise<DailyLook> {
  return api.post<DailyLook>("/look/generate", input, { timeoutMs: TIMEOUTS.generateLook });
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

export function generateStyleSheetPreview(outfit: DailyLook): Promise<StyleSheetResult> {
  return api.post<StyleSheetResult>("/look/style-sheet", { outfit }, { timeoutMs: TIMEOUTS.lookVisual });
}

/**
 * The single-photo edit preview — the member's own selfie with the outfit
 * composited on. The optional secondary visual beside the style sheet. Same
 * partial-result contract as the style sheet.
 */
export type PhotoPreviewResult =
  | { imageDataUri: string; mode: "photo_edit" }
  | { imageDataUri: null; mode: "unavailable"; reason: string };

export function generatePhotoPreview(outfit: DailyLook): Promise<PhotoPreviewResult> {
  return api.post<PhotoPreviewResult>("/look/photo-preview", { outfit }, {
    timeoutMs: TIMEOUTS.lookVisual,
  });
}

export type SaveLookInput = DailyLook & {
  imageDataUri: string;
  weather: string;
  vibe: Vibe;
  /** Which pipeline produced the saved visual — written into the row. */
  previewMode: "style_sheet" | "photo_edit";
};
