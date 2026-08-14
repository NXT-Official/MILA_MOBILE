/**
 * Copied from the web's `src/lib/utils.ts`, split per function per Appendix A.
 *
 * The second branch is the whole point: Supabase returns a `PostgrestError`,
 * which is a plain object and **not** an `Error` instance, so an
 * `instanceof Error` check alone silently swallows every database message.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message: unknown };
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
