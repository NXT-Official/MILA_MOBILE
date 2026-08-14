import type { DailyLook, LensAnalysisRecord } from "@/types/look";

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
 * Structural, not `type`-tagged, for the daily-look branch's sub-objects: the
 * tag says what the row is, but a truncated write could still leave `hair`
 * missing, and a missing section should render empty rather than throw halfway
 * down the screen.
 */
export function normalizeAnalysisResult(value: unknown): HistoryEntry {
  if (!isRecord(value)) return { kind: "unavailable" };

  if (value.type === "daily_look") {
    const outfit = isRecord(value.outfit) ? value.outfit : {};
    const hair = isRecord(value.hair) ? value.hair : {};
    const makeup = isRecord(value.makeup) ? value.makeup : {};

    return {
      kind: "daily_look",
      look: {
        outfit: {
          headline: str(outfit.headline),
          description: str(outfit.description),
          styling_notes: str(outfit.styling_notes),
        },
        hair: { style: str(hair.style), execution_tip: str(hair.execution_tip) },
        makeup: { palette: str(makeup.palette), details: str(makeup.details) },
        vibe_alignment_score:
          typeof value.vibe_alignment_score === "number" ? value.vibe_alignment_score : 0,
      },
      weather: optionalStr(value.weather),
      vibe: optionalStr(value.vibe),
    };
  }

  // The Lens shape carries no tag, so it is identified by its own fields.
  if (typeof value.overall_score === "number" || typeof value.verdict === "string") {
    return {
      kind: "lens",
      analysis: {
        color_match: str(value.color_match),
        silhouette: str(value.silhouette),
        overall_score: typeof value.overall_score === "number" ? value.overall_score : 0,
        verdict: str(value.verdict),
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
  const makeupBody = [look.makeup.palette, look.makeup.details].filter(Boolean).join("\n\n");

  return [
    { title: "Outfit", body: outfitBody },
    { title: "Hair", body: hairBody },
    { title: "Makeup", body: makeupBody },
  ].filter((section) => section.body.length > 0);
}
