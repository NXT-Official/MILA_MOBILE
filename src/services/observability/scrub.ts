import { sanitizeUrl } from "./url-sanitize";

/**
 * Scrubbing for everything that leaves the device through an error or log
 * SDK: emails, JWTs, bearer tokens, data URIs, base64 blobs, and credentials in
 * URLs. Same intent as the PostHog hook in `../posthog.ts` and the web app's
 * scrubbers. Fail closed: an event this cannot read is dropped, never sent raw.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const BEARER = /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;
const DATA_URI = /data:[a-z]+\/[a-z0-9.+-]+(?:;[a-z0-9=.+-]+)*,[A-Za-z0-9+/=%_-]*/gi;
const LONG_BASE64 = /[A-Za-z0-9+/_-]{120,}={0,2}/g;
// URLs and bare paths in text both go through the shared allowlist sanitizer
// (url-sanitize.ts); a token runs to whitespace or a closing delimiter.
const URL_TOKEN = /[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)]+/gi;
const BARE_PATH = /(^|[\s"'(=])(\/[^\s"'<>)]*)/g;

/** Removes secrets and personal data from one string. */
export function scrubText(text: string): string {
  return text
    .replace(DATA_URI, "[data-uri]")
    .replace(JWT, "[jwt]")
    .replace(BEARER, "$1[token]")
    .replace(URL_TOKEN, sanitizeUrl)
    .replace(BARE_PATH, (_m, lead: string, path: string) => lead + sanitizeUrl(path))
    .replace(EMAIL, "[email]")
    .replace(LONG_BASE64, "[base64]");
}

/** Reduces a router path to its pathname; the query and fragment never leave. */
export function scrubPath(path: string): string {
  return sanitizeUrl(path.split(/[?#]/, 1)[0] ?? "");
}

const MAX_DEPTH = 8;

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return scrubText(value);
  if (typeof value !== "object" || value === null) return value;
  // Fail closed: past the limit nothing unscrubbed is passed through.
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = scrubValue(v, depth + 1);
  return out;
}

// Request pieces that can carry credentials wholesale.
const DROPPED_REQUEST_KEYS = ["cookies", "headers", "data", "query_string"] as const;

/**
 * Sentry `beforeSend` / `beforeBreadcrumb` / log hook body. Generic over the
 * event shape so one function serves all three. Keeps the Supabase user id and
 * nothing else on `user`.
 */
export function scrubSentryEvent<T extends object>(event: T): T | null {
  try {
    const next = scrubValue(event, 0) as Record<string, unknown>;
    const user = (event as { user?: { id?: unknown } }).user;
    if (user) {
      next.user = typeof user.id === "string" ? { id: user.id } : undefined;
    }
    const request = next.request;
    if (request && typeof request === "object") {
      for (const key of DROPPED_REQUEST_KEYS) delete (request as Record<string, unknown>)[key];
    }
    return next as T;
  } catch {
    return null;
  }
}
