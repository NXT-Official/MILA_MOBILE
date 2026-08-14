import type { ClimateCondition } from "@/constants/climate";
import type { Vibe } from "@/constants/vibes";
import type { DailyLook } from "@/types/look";

import { api, TIMEOUTS } from "./client";

export type { DailyLook } from "@/types/look";

/**
 * The daily look pipeline. Three calls, and the **order is the billing**:
 *
 *   /look/generate  charges 1 credit and sets `look_image_pending`
 *   /look/image     claims that flag, so the first visual is free
 *   /look/save      free
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
};

export function generateDailyLook(input: GenerateLookInput): Promise<DailyLook> {
  return api.post<DailyLook>("/look/generate", input, { timeoutMs: TIMEOUTS.generateLook });
}

/**
 * `imageDataUri` is null when the provider returned nothing. That is not an
 * exception — the server has already re-marked the pending flag or refunded the
 * credit, and the caller's job is to keep the written look on screen and offer
 * a retry. Partial success is a first-class state (§8).
 */
export type LookImageResult = {
  imageDataUri: string | null;
  imageGenerationError?: string;
};

export function regenerateOutfitImage(look: DailyLook): Promise<LookImageResult> {
  return api.post<LookImageResult>("/look/image", look, { timeoutMs: TIMEOUTS.lookImage });
}

export type SaveLookInput = DailyLook & {
  imageDataUri: string;
  weather: string;
  vibe: Vibe;
};

export type SavedLook = {
  id: string;
  image_url: string;
  created_at: string;
};

/**
 * The generated visual travels as a `data:` URI and reaches storage only here,
 * server-side, under `${userId}/`. The client uploads nothing in this phase —
 * which is also why there is no client-supplied URL anywhere in this file (§8).
 */
export function saveOutfitToHistory(input: SaveLookInput): Promise<SavedLook> {
  return api.post<SavedLook>("/look/save", input, { timeoutMs: TIMEOUTS.default });
}
