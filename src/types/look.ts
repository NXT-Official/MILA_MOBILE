/**
 * The daily look, as the server composes it. Lives in `types/` rather than
 * beside the API call because `lib/outfit-history.ts` also needs it, and `lib/`
 * is pure — it may not reach into `services/`.
 *
 * These field names are the server's, not ours. They are snake_case because the
 * API is, and renaming them on the way in would mean two vocabularies for one
 * object.
 */
export type LookOutfit = { headline: string; description: string; styling_notes: string };
export type LookHair = { style: string; execution_tip: string };
export type LookMakeup = { palette: string; details: string };

export type DailyLook = {
  outfit: LookOutfit;
  hair: LookHair;
  makeup: LookMakeup;
  vibe_alignment_score: number;
};

/**
 * What `outfits.analysis_result` holds for a saved daily look. Written
 * server-side by `/look/save`; the client only ever reads it back.
 */
export type DailyLookRecord = DailyLook & {
  type: "daily_look";
  weather: string;
  vibe: string;
};

/** The Lens shape the same column holds. Phase 05 writes it; history reads it. */
export type LensAnalysisRecord = {
  color_match: string;
  silhouette: string;
  overall_score: number;
  verdict: string;
};
