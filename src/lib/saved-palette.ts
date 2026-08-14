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

/** The three swatches, each paired with its name — never a bare hex (§11). */
export function paletteSwatches(
  palette: DailyPalette,
): { role: string; name: string; hex: string }[] {
  return [
    { role: "Base layer", name: palette.baseColor, hex: palette.baseHex },
    { role: "Statement", name: palette.statementColor, hex: palette.statementHex },
    { role: "Accent pop", name: palette.accentColor, hex: palette.accentHex },
  ];
}
