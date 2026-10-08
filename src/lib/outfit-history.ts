import type { DailyLook, LensAnalysisRecord, ShoppablePick } from "@/types/look";

import { GARMENT_KIND_ORDER, type GarmentKind } from "./garment-label";
import { searchTextOf, type HistorySummary } from "./history-filter";
import { asWearColour, MAX_SAVED_COLOUR_MAP_ROWS, type SavedColourMapRow } from "./wear-colour";

/**
 * A saved daily look.
 *
 * The generated shape (`DailyLook`) requires a 1–10 score; a saved row may
 * carry none — an older write, or a partial one — and History has to read that
 * as *absent* rather than as a score of zero. The web makes the same split: its
 * generated schema requires the number and its history detail renders the chip
 * only when the value is non-null.
 */
export type SavedLookSnapshot = Omit<DailyLook, "vibe_alignment_score"> & {
  vibe_alignment_score: number | null;
  /** The saved colour map; absent on a look saved before it, or when damaged. */
  colourMap?: SavedColourMapRow[];
};

/**
 * `outfits.analysis_result` is polymorphic: a saved daily look, a Lens
 * analysis, or — for a row written by an older client or a partial failure —
 * neither. Normalising it here means History and Look detail each read one
 * shape, and an unrecognised row degrades to a card rather than a crash.
 */
export type HistoryEntry =
  | { kind: "daily_look"; look: SavedLookSnapshot; weather: string | null; vibe: string | null }
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

/** https/http only — these links are opened externally, so a stored
 * `javascript:`/`data:` URL must never become a pressable row. */
function isHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * A saved look's shoppable picks are display-only on History; a pick missing
 * its link or title is dropped rather than rendered as a broken card — and a
 * pick whose link is not http(s) never becomes a row (the links are opened
 * externally). The array itself is kept even when empty: a look saved with no
 * picks shows the grid's own "no verified item" copy, exactly like a freshly
 * generated look with none — an ABSENT key (older rows) stays hidden.
 */
function normalizePicks(value: unknown): ShoppablePick[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const picks = value
    .filter(isRecord)
    .filter((pick) => str(pick.id) && str(pick.title) && isHttpUrl(str(pick.affiliate_link)))
    .map((pick): ShoppablePick => ({
      id: str(pick.id),
      title: str(pick.title),
      brand_id: str(pick.brand_id),
      category: str(pick.category),
      price: typeof pick.price === "number" ? pick.price : 0,
      currency: str(pick.currency) || "USD",
      image_url: isHttpUrl(str(pick.image_url)) ? str(pick.image_url) : null,
      affiliate_link: str(pick.affiliate_link),
      verification_status: str(pick.verification_status),
      last_verified_at: optionalStr(pick.last_verified_at),
      rationale: str(pick.rationale),
    }));
  return picks;
}

function isGarmentKind(value: unknown): value is GarmentKind {
  return typeof value === "string" && (GARMENT_KIND_ORDER as readonly string[]).includes(value);
}

/**
 * A saved look's colour map. A row needs its kind, label and title to be
 * readable; its colour is read back through `asWearColour`, so one that is not
 * whole and safe becomes "no colour" and the row stays. Anything that is not a
 * list of such rows is no map at all, so an old or damaged look shows nothing
 * extra.
 */
function normalizeColourMap(value: unknown): SavedColourMapRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .filter(isRecord)
    .filter((row) => isGarmentKind(row.kind) && str(row.label) && str(row.title))
    .slice(0, MAX_SAVED_COLOUR_MAP_ROWS)
    .map(
      (row): SavedColourMapRow => ({
        kind: row.kind as GarmentKind,
        label: str(row.label),
        title: str(row.title),
        wear: asWearColour(row.wear),
      }),
    );
  return rows.length > 0 ? rows : undefined;
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
        vibe_alignment_score:
          typeof raw.vibe_alignment_score === "number" ? raw.vibe_alignment_score : null,
        shoppable_picks: normalizePicks(raw.shoppable_picks),
        forecastRetrievedAt: optionalStr(raw.forecastRetrievedAt),
        colourMap: normalizeColourMap(raw.colourMap),
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

/**
 * The web's download filename slug, verbatim: `mila-<headline>.jpg`. The
 * dashboard's style sheet and History's saved-look download both name their
 * files from a look's headline, so the transform lives here once.
 */
export function headlineSlug(headline: string): string {
  return headline.toLowerCase().replace(/\s+/g, "-");
}

/**
 * A saved row's display title — the web's `historyItemTitle`, one
 * implementation: History's grid, the look detail, and the concierge archive
 * picker all name the same row.
 */
export function outfitTitle(entry: HistoryEntry): string {
  if (entry.kind === "daily_look") return entry.look.outfit.headline || "Saved look";
  if (entry.kind === "lens") return "Lens analysis";
  return "Saved look";
}

/** The three collapsible sections, in the §3 order, with empties dropped. */
export function lookSections(
  look: Pick<DailyLook, "outfit" | "hair" | "makeup">,
): { title: string; body: string }[] {
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

/**
 * What History's search, sort and category views read for one saved row (see
 * `history-filter.ts`, shared with the web). A look is filed under its vibe and
 * found by what it said and the items it suggested; an analysis by its verdict.
 */
export function historySummary(row: {
  id: string;
  created_at: string;
  analysis_result: unknown;
}): HistorySummary {
  const entry = normalizeAnalysisResult(row.analysis_result);
  const title = outfitTitle(entry);
  const base = { id: row.id, createdAt: row.created_at, title };

  if (entry.kind === "daily_look") {
    const { look } = entry;
    return {
      ...base,
      kind: "look",
      category: entry.vibe?.trim() || null,
      score: look.vibe_alignment_score,
      searchText: searchTextOf([
        title,
        entry.vibe,
        entry.weather,
        look.outfit.description,
        look.outfit.styling_notes,
        look.hair.style,
        look.makeup?.palette,
        ...(look.shoppable_picks ?? []).map((pick) => pick.title),
      ]),
    };
  }

  if (entry.kind === "lens") {
    const { analysis } = entry;
    return {
      ...base,
      kind: "analysis",
      category: null,
      score: null,
      searchText: searchTextOf([
        title,
        analysis.verdict,
        analysis.color_match,
        analysis.silhouette,
      ]),
    };
  }

  return { ...base, kind: "other", category: null, score: null, searchText: searchTextOf([title]) };
}
