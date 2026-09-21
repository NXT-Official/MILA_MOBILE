/**
 * The web reads its JSONB tag columns inline — `Array.isArray(value) ?
 * value.filter(string) : []` — in the tag steps and again in the review. One
 * copy here, because a legacy row can hold an object or a string in any of
 * these columns and a chip list must not crash on it.
 */
export function tagList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === "string")
    : [];
}
