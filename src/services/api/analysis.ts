import type { LensAnalysisRecord } from "@/types/look";
import type { PersonalColorAnalysisResult } from "@/types/models";

import { api, TIMEOUTS } from "./client";

/**
 * `POST /analysis/outfit` — **1 credit**, rate limited to 15/hour, both metered
 * server-side (§6). This file sends typed input and receives typed output; it
 * holds no prompt, no model name, and no provider.
 *
 * `imageUrl` **must** already be a Mila public-storage URL. Upload through
 * `services/supabase/storage.ts` first — the server rejects anything else, and
 * that rejection is the SSRF defence rather than a validation nicety.
 */
export type AnalyzeOutfitInput = {
  imageUrl: string;
  bodyType: string;
  colorSeason: string;
};

export function analyzeOutfit(input: AnalyzeOutfitInput): Promise<LensAnalysisRecord> {
  return api.post<LensAnalysisRecord>("/analysis/outfit", input, {
    timeoutMs: TIMEOUTS.analysis,
  });
}

/**
 * `POST /analysis/personal-color` — the live studio colour read behind the
 * onboarding "Analyze my coloring" path. **Only** the live path exists: no
 * sample face, no fabricated result (phase-02 contract).
 *
 * The founding read (no colour dossier on file yet) is free server-side;
 * re-reads cost **1 AI credit**, 10/hour either way. `imageBase64` is the raw
 * JPEG payload with **no** data-URI prefix — the camera adapters already cap
 * captures at ~1440px / q0.85, which is the size the endpoint expects.
 *
 * Failures ride a 200 as `{ success: false, error }`; the caller maps the
 * codes to member-facing copy (`lib/personal-color-copy.ts`) and never shows
 * the code itself. A thrown `ApiError` means the request failed before the
 * read — `resolveApiFailure` owns that copy.
 */
export type AnalyzePersonalColorInput = {
  imageBase64: string;
};

export function analyzePersonalColor(
  input: AnalyzePersonalColorInput,
): Promise<PersonalColorAnalysisResult> {
  return api.post<PersonalColorAnalysisResult>("/analysis/personal-color", input, {
    timeoutMs: TIMEOUTS.personalColor,
  });
}
