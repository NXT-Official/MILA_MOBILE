import type { DailyPalette } from "@/lib/color-analysis/paletteGenerator";

/**
 * `saved_palettes.palette` is a JSONB column, so a row written by an older
 * client — or by a shape that has since changed — is entirely possible. The web
 * validates every row before display for the same reason.
 *
 * Pure, and in `lib/` rather than beside the query, because a palette that
 * fails this check must be skipped identically on both clients: a member who
 * pinned a palette on the web should not see a half-rendered card on her phone.
 */
const STRING_FIELDS = [
  "baseColor",
  "statementColor",
  "accentColor",
  "baseHex",
  "statementHex",
  "accentHex",
  "styleVibe",
  "insight",
] as const;

export function isDailyPalette(value: unknown): value is DailyPalette {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    STRING_FIELDS.every((f) => typeof v[f] === "string") &&
    typeof v.isSisterSeasonIncluded === "boolean"
  );
}

/**
 * Where each colour goes. Same three lines as the web's `WEAR_LINES`, in the
 * mobile app's UK spelling: the shared `daily-palette` module is a verbatim
 * copy of the web's, so its own US-spelled strings are never shown here.
 */
export const WEAR_LINES_UK = {
  base: "Bottoms or a jacket",
  statement: "Top, near your face",
  accent: "Shoes, bag or jewellery",
} as const;

export const OWN_COLOURS_VIBE = "From your colours";

/** The three swatches, each with its name and where to wear it, never a bare hex (§11). */
export function paletteSwatches(
  palette: DailyPalette,
): { role: string; name: string; hex: string; wear: string }[] {
  return [
    { role: "Base", name: palette.baseColor, hex: palette.baseHex, wear: WEAR_LINES_UK.base },
    {
      role: "Statement",
      name: palette.statementColor,
      hex: palette.statementHex,
      wear: WEAR_LINES_UK.statement,
    },
    { role: "Accent", name: palette.accentColor, hex: palette.accentHex, wear: WEAR_LINES_UK.accent },
  ];
}

/** The wear sentence for a palette built from her own colours. */
function wearInsight(palette: DailyPalette): string {
  return `Wear ${palette.baseColor} on your bottoms or a jacket, ${palette.statementColor} on top near your face, and ${palette.accentColor} on your shoes, bag or jewellery.`;
}

/**
 * The line under a palette. One built from her own colours is written here in
 * UK spelling; a curated or older palette keeps the copy it was saved with.
 */
export function paletteInsight(palette: DailyPalette): string {
  return palette.source === "swatches" ? wearInsight(palette) : palette.insight;
}

/** The vibe badge, with the same rule as `paletteInsight`. */
export function paletteVibe(palette: DailyPalette): string {
  return palette.source === "swatches" ? OWN_COLOURS_VIBE : palette.styleVibe;
}
