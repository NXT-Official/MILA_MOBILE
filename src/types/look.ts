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

/**
 * One real, in-stock catalogue row the server hydrated from the model's raw
 * `product_id` picks. The price, link, and title always come from the database,
 * never from model text — and a pick whose id matches no live row is dropped
 * server-side rather than trusted.
 */
export type ShoppablePick = {
  id: string;
  title: string;
  brand_id: string;
  category: string;
  price: number;
  currency: string;
  image_url: string | null;
  affiliate_link: string;
  verification_status: string;
  last_verified_at: string | null;
  rationale: string;
  /**
   * Which shelf this pick belongs on: "planned" = a piece of the composed
   * outfit (what the style-sheet render actually wears); "similar" = an extra
   * shoppable option beside the look. Absent on looks saved before the field
   * existed — treat a missing value as "planned".
   */
  source?: "planned" | "similar";
};

export type DailyLook = {
  outfit: LookOutfit;
  hair: LookHair;
  /**
   * Null when makeup is disabled for this member — the server's hard boundary,
   * not a suggestion. Rendered by dropping the Makeup section, never by
   * inventing one.
   */
  makeup: LookMakeup | null;
  /**
   * 1–10 for a freshly generated look — the server's schema requires it. A
   * *saved* row can still carry none; that shape is `SavedLookSnapshot` in
   * `lib/outfit-history.ts`.
   */
  vibe_alignment_score: number;
  /**
   * Real product rows, hydrated server-side. Absent (not empty) when the
   * catalogue matched nothing for this look — an empty state, not an error.
   */
  shoppable_picks?: ShoppablePick[];
  /**
   * Set when the server fetched a live Open-Meteo forecast; null when the
   * weather came from the client-supplied label instead. Written into the
   * saved row so history can tell the two apart.
   */
  forecastRetrievedAt?: string | null;
  /**
   * The direction the look defaulted to when the profile was neither an
   * explicit Male nor Female one, so a rendered visual matches the pieces the
   * shopper actually used. Null for an explicit direction or an all-Unisex
   * look; absent on looks composed before the field existed.
   */
  fallback_gender_direction?: "Male" | "Female" | null;
};

/**
 * What `outfits.analysis_result` holds for a saved daily look. Written by the
 * save path (direct through RLS); the client only ever reads it back.
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
