/**
 * Copied from the web's `src/lib/utils.ts`, split per function per Appendix A.
 *
 * **Hermes does not ship `Intl.RelativeTimeFormat`** unless the app is built
 * against the full-ICU variant, and the default Expo Android build is not.
 * `Intl.NumberFormat` and `Intl.DateTimeFormat` are present; this one is not.
 *
 * That matters more than it looks: the formatter used to be constructed at
 * module scope, so importing this file *threw* on device. Every route that
 * transitively imported it — Feed, Concierge, Palettes, and the member profile
 * — failed to evaluate and Expo Router reported them as "missing the required
 * default export", which points at the route rather than at the cause.
 *
 * So: probe once, and carry a plain-English fallback. Node has the API and the
 * device may not, which is exactly why the unit test alone did not catch this.
 */

type RelativeUnit = "year" | "month" | "week" | "day" | "hour" | "minute";

const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
] as const;

/**
 * Built lazily and cached, so a throwing constructor cannot take the module
 * down at import time — the failure mode that caused this.
 */
let formatter: Intl.RelativeTimeFormat | null | undefined;

function relativeFormatter(): Intl.RelativeTimeFormat | null {
  if (formatter !== undefined) return formatter;

  try {
    formatter =
      typeof Intl !== "undefined" && typeof Intl.RelativeTimeFormat === "function"
        ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
        : null;
  } catch {
    // Present but unusable — a partial ICU build can expose the constructor
    // and still reject the locale.
    formatter = null;
  }

  return formatter;
}

/**
 * The fallback. Deliberately unlocalised English rather than a date library:
 * this is a timestamp under a feed card, and adding a dependency to render
 * "2 hours ago" is not a trade worth making.
 */
function fallback(value: number, unit: RelativeUnit | "second"): string {
  const amount = Math.abs(value);
  if (unit === "second" && amount === 0) return "now";

  const noun = amount === 1 ? unit : `${unit}s`;
  return value < 0 ? `${amount} ${noun} ago` : `in ${amount} ${noun}`;
}

function format(value: number, unit: RelativeUnit | "second"): string {
  return relativeFormatter()?.format(value, unit) ?? fallback(value, unit);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  if (!Number.isFinite(seconds)) return "";

  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format(Math.round(seconds / size), unit);
  }
  return format(0, "second");
}

/** Exported for the test that exercises the device path. Not for app code. */
export const __testing = { fallback, resetFormatterCache: () => void (formatter = undefined) };
