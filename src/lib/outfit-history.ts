import type { DailyLook, LensAnalysisRecord, ShoppablePick } from "@/types/look";

/**
 * `outfits.analysis_result` is polymorphic: a saved daily look, a Lens
 * analysis, or — for a row written by an older client or a partial failure —
 * neither. Normalising it here means History and Look detail each read one
 * shape, and an unrecognised row degrades to a card rather than a crash.
 */
export type HistoryEntry =
  | { kind: "daily_look"; look: DailyLook; weather: string | null; vibe: string | null }
  | { kind: "lens"; analysis: LensAnalysisRecord }
  | { kind: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * A saved look's shoppable picks are display-only on History; a pick missing
 * its link or title is dropped rather than rendered as a broken card. The
 * picks were hydrated from live rows before saving, so this guard only ever
 * fires on a row damaged after the fact.
 */
function normalizePicks(value: unknown): ShoppablePick[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const picks = value
    .filter(isRecord)
    .filter((pick) => str(pick.id) && str(pick.title) && str(pick.affiliate_link))
    .map((pick): ShoppablePick => ({
      id: str(pick.id),
      title: str(pick.title),
      brand_id: str(pick.brand_id),
      category: str(pick.category),
      price: typeof pick.price === "number" ? pick.price : 0,
      currency: str(pick.currency) || "USD",
      image_url: optionalStr(pick.image_url),
      affiliate_link: str(pick.affiliate_link),
      verification_status: str(pick.verification_status),
      last_verified_at: optionalStr(pick.last_verified_at),
      rationale: str(pick.rationale),
    }));
  return picks.length > 0 ? picks : undefined;
}

/**
 * Structural, not `type`-tagged, for the daily-look branch's sub-objects: the
 * tag says what the row is, but a truncated write could still leave `hair`
 * missing, and a missing section should render empty rather than throw halfway
 * down the screen.
 *
 * `makeup` is the one field with a meaningful null: the server writes null
 * when makeup is disabled for the member, and that must survive normalisation
 * as null — coercing it to an empty object would re-create the Makeup section
 * the server deliberately omitted. The same distinction the web's history
 * makes (`value.makeup === null || isPlainObject(value.makeup)`).
 */
export function normalizeAnalysisResult(value: unknown): HistoryEntry {
  let raw = value;
  // Supabase returns jsonb parsed, but a double-encoded row is possible and the
  // web's history defends against it; two behaviours here is how one client
  // shows a look the other cannot.
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { kind: "unavailable" };
    }
  }
  if (!isRecord(raw)) return { kind: "unavailable" };

  if (raw.type === "daily_look") {
    const outfit = isRecord(raw.outfit) ? raw.outfit : {};
    const hair = isRecord(raw.hair) ? raw.hair : {};
    const makeup = isRecord(raw.makeup) ? raw.makeup : null;

    return {
      kind: "daily_look",
      look: {
        outfit: {
          headline: str(outfit.headline),
          description: str(outfit.description),
          styling_notes: str(outfit.styling_notes),
        },
        hair: { style: str(hair.style), execution_tip: str(hair.execution_tip) },
        makeup: makeup ? { palette: str(makeup.palette), details: str(makeup.details) } : null,
        vibe_alignment_score: typeof raw.vibe_alignment_score === "number" ? raw.vibe_alignment_score : 0,
        shoppable_picks: normalizePicks(raw.shoppable_picks),
        forecastRetrievedAt: optionalStr(raw.forecastRetrievedAt),
      },
      weather: optionalStr(raw.weather),
      vibe: optionalStr(raw.vibe),
    };
  }

  // The Lens shape carries no tag, so it is identified by its own fields.
  if (typeof raw.overall_score === "number" || typeof raw.verdict === "string") {
    return {
      kind: "lens",
      analysis: {
        color_match: str(raw.color_match),
        silhouette: str(raw.silhouette),
        overall_score: typeof raw.overall_score === "number" ? raw.overall_score : 0,
        verdict: str(raw.verdict),
      },
    };
  }

  return { kind: "unavailable" };
}

/** The three collapsible sections, in the §3 order, with empties dropped. */
export function lookSections(look: DailyLook): { title: string; body: string }[] {
  const outfitBody = [look.outfit.description, look.outfit.styling_notes]
    .filter(Boolean)
    .join("\n\n");
  const hairBody = [look.hair.style, look.hair.execution_tip].filter(Boolean).join("\n\n");
  const makeupBody = look.makeup
    ? [look.makeup.palette, look.makeup.details].filter(Boolean).join("\n\n")
    : "";

  return [
    { title: "Outfit", body: outfitBody },
    { title: "Hair", body: hairBody },
    { title: "Makeup", body: makeupBody },
  ].filter((section) => section.body.length > 0);
}
