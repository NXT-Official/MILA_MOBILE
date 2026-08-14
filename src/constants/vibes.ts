/**
 * The 11 occasions, verbatim from the web (§3). The strings are sent to the
 * styling endpoint in Phase 04 and appear in prompts — a reworded label is a
 * different prompt, so they are not editorial copy.
 */
export const VIBES = [
  "Everyday Casual",
  "Work or School",
  "Business Casual",
  "Business Attire",
  "Brunch",
  "Date Night",
  "Dinner",
  "Party",
  "Formal Event",
  "Travel",
  "Active Day",
] as const;

export type Vibe = (typeof VIBES)[number];

export const DEFAULT_VIBE: Vibe = "Everyday Casual";

export function isVibe(value: unknown): value is Vibe {
  return typeof value === "string" && (VIBES as readonly string[]).includes(value);
}
