import type { LensAnalysisRecord } from "@/types/look";

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
