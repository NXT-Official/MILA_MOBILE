/**
 * Copied from the web's `src/lib/utils.ts`, split per function per Appendix A.
 *
 * `Intl.RelativeTimeFormat` is present in Hermes with the full ICU build that
 * React Native ships on Android, so this needs no polyfill and no date library.
 */
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
] as const;

export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  if (!Number.isFinite(seconds)) return "";
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, "second");
}
