/**
 * The §3 thresholds, exactly. "Still up" before 5am is the one that carries the
 * brand: it notices she is awake at an odd hour without commenting on it.
 */
export function greetingPrefix(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The first word of `full_name`, or nothing. A member who entered only a
 * surname, a single word, or whitespace gets an unsuffixed greeting rather than
 * "Good morning, " with a dangling comma.
 */
export function firstName(fullName: string | null | undefined): string | null {
  if (typeof fullName !== "string") return null;
  const first = fullName.trim().split(/\s+/)[0];
  return first ? first : null;
}

export function greeting(now: Date, fullName: string | null | undefined): string {
  const prefix = greetingPrefix(now.getHours());
  const name = firstName(fullName);
  return name ? `${prefix}, ${name}` : prefix;
}
