// Shared URL sanitizer (moved verbatim from posthog.ts; no behaviour change).
// posthog.ts re-exports it, and observability/scrub.ts reuses it so there is
// one allowlist, never a second denylist.

/** What `sanitizeUrl` returns for input it cannot parse: never the raw string. */
const UNPARSEABLE_URL = "[unparseable-url]";

// ALLOWLIST: the only query params analytics may keep. Everything else is
// dropped, so a new auth provider's param, a free-text search (?q=) or an
// address can never leak by being absent from a denylist.
const ALLOWED_PARAMS: ReadonlySet<string> = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "page",
  "tab",
  "section",
  "view",
  "sort",
]);

const MAX_DECODE_ROUNDS = 5;

// Percent-decodes (and turns `+` into a space) until the text stops changing,
// so `%2563ode` cannot hide as `%63ode`. Returns null when it cannot settle or
// is malformed: the caller drops what it cannot read.
function decodeToFixedPoint(raw: string): string | null {
  let current = raw;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round += 1) {
    let next: string;
    try {
      next = decodeURIComponent(current.replace(/\+/g, " "));
    } catch {
      return null;
    }
    if (next === current) return current;
    current = next;
  }
  return null;
}

// A run of 20+ letters/digits (hex, base64url body) or a JWT shape.
const TOKEN_RUN = /[A-Za-z0-9]{20,}/;
const JWT_SHAPE = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/;
const SAFE_VALUE = /^[A-Za-z0-9 _.,-]{0,64}$/;

// A kept param's value must be short, plain text. Anything with `=`, `&`, `/`,
// `:` or `@` (a nested query, URL or address) or that looks like a token goes.
function isSafeValue(value: string): boolean {
  return (
    SAFE_VALUE.test(value) && !TOKEN_RUN.test(value) && !JWT_SHAPE.test(value)
  );
}

// `query` is the raw text after `?` (no fragment).
function sanitizeQuery(query: string): string {
  const kept: string[] = [];
  for (const pair of query.split(/[&;]/)) {
    if (pair === "") continue;
    const eq = pair.indexOf("=");
    const name = decodeToFixedPoint(eq === -1 ? pair : pair.slice(0, eq))
      ?.trim()
      .toLowerCase();
    if (!name || !ALLOWED_PARAMS.has(name)) continue;
    if (eq === -1) {
      kept.push(name);
      continue;
    }
    const value = decodeToFixedPoint(pair.slice(eq + 1));
    if (value === null || !isSafeValue(value)) continue;
    kept.push(`${name}=${encodeURIComponent(value)}`);
  }
  return kept.length > 0 ? `?${kept.join("&")}` : "";
}

const TOKEN_SEGMENT = /^[A-Za-z0-9_-]{20,}$/;
const PLACEHOLDER_SEGMENT = ":token";

// A path segment that looks like a credential (base64url/hex of 20+, or a JWT),
// or hides query/fragment syntax behind percent-encoding, becomes `:token`.
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Replaces every email address in free text with `[email]`. */
export function maskEmails(text: string): string {
  return text.replace(EMAIL_IN_TEXT, "[email]");
}

function sanitizeSegment(segment: string): string {
  if (segment === "") return segment;
  const decoded = decodeToFixedPoint(segment);
  if (decoded === null || /[#?=&;]/.test(decoded)) return PLACEHOLDER_SEGMENT;
  // An email in a path is personal data: mask it (decoded, so %40 is caught).
  const masked = maskEmails(decoded);
  if (masked !== decoded) return masked;
  if (TOKEN_SEGMENT.test(decoded) || JWT_SHAPE.test(decoded))
    return PLACEHOLDER_SEGMENT;
  return segment;
}

function sanitizePath(path: string): string {
  return path.split("/").map(sanitizeSegment).join("/");
}

function isAuthSegment(segment: string): boolean {
  return (
    (decodeToFixedPoint(segment) ?? segment).trim().toLowerCase() === "auth"
  );
}

// scheme://authority/path — the shape of every deep link and universal link.
const HIERARCHICAL_URL = /^([a-z][a-z0-9+.-]*:\/\/)([^/]*)(.*)$/i;

/**
 * Reduces a URL to what analytics may keep: scheme://host, the path with
 * credential-looking segments replaced by `:token`, and only the allowlisted
 * query params with plain values. The fragment is always dropped, and so is the
 * whole query on `/auth/*` paths and `mila://auth*` deep links. Embedded
 * credentials (userinfo) are dropped. Accepts `scheme://...` URLs (deep links
 * such as `mila://auth/callback`, and universal links) and bare paths; anything
 * else, including `mailto:`, becomes a fixed placeholder. Pure string work on
 * purpose: Hermes' built-in `URL` does not implement `search`/`searchParams`,
 * and this runs before any polyfill.
 */
export function sanitizeUrl(url: string): string {
  const hashAt = url.indexOf("#");
  const withoutFragment = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = withoutFragment.indexOf("?");
  const head =
    queryAt === -1 ? withoutFragment : withoutFragment.slice(0, queryAt);
  const query = queryAt === -1 ? "" : withoutFragment.slice(queryAt + 1);

  if (head.startsWith("/") && !head.startsWith("//")) {
    const keep = isAuthSegment(head.split("/")[1] ?? "")
      ? ""
      : sanitizeQuery(query);
    return `${sanitizePath(head)}${keep}`;
  }

  const match = HIERARCHICAL_URL.exec(head);
  if (!match) return UNPARSEABLE_URL;
  const scheme = match[1] ?? "";
  const host = (match[2] ?? "").replace(/^.*@/, "");
  const path = match[3] ?? "";
  if (host === "" && path === "") return UNPARSEABLE_URL;
  const auth =
    host.toLowerCase().startsWith("auth") ||
    isAuthSegment(path.split("/")[1] ?? "");
  const keep = auth ? "" : sanitizeQuery(query);
  // A web host is a name, never a token; a custom-scheme host can be one.
  const safeHost = /^https?:\/\/$/i.test(scheme) ? host : sanitizeSegment(host);
  return `${scheme}${safeHost}${sanitizePath(path)}${keep}`;
}

/**
 * A router pathname for screen-view analytics: the query and fragment are
 * dropped, id-like segments (uuids, long ids) become `:token`, emails are
 * masked.
 */
export function sanitizeScreenPath(name: string): string {
  return sanitizePath(name.split(/[?#]/, 1)[0] ?? "");
}
