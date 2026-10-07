import PostHog, { type PostHogOptions } from "posthog-react-native";

// The hook's types come from the SDK's own options so they cannot drift from
// the installed version. `before_send` accepts one function or an array.
type BeforeSendFn = Exclude<
  NonNullable<PostHogOptions["before_send"]>,
  readonly unknown[]
>;
type CaptureEvent = NonNullable<Parameters<BeforeSendFn>[0]>;
type EventProps = NonNullable<CaptureEvent["properties"]>;

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
function sanitizeSegment(segment: string): string {
  if (segment === "") return segment;
  const decoded = decodeToFixedPoint(segment);
  if (decoded === null || /[#?=&;]/.test(decoded)) return PLACEHOLDER_SEGMENT;
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

// A screen name is a router pathname: it has no query or fragment by
// definition, so anything after `?` or `#` is dropped rather than parsed.
function screenPath(name: string): string {
  return name.split(/[?#]/, 1)[0] ?? "";
}

// Properties that hold a page URL, referrer or path. The mobile SDK does not
// set these itself; they are listed so the hook matches the web app's contract
// and a future property of this shape is scrubbed too.
const URL_PROPERTY_KEYS = [
  "$current_url",
  "$referrer",
  "$pathname",
  "$initial_current_url",
  "$initial_referrer",
] as const;

// Lifecycle event the SDK fires on launch, carrying `Linking.getInitialURL()`
// as `url`: a cold start from `mila://auth/callback#access_token=…` lands here.
// src: posthog-react-native@4.79.0 dist/posthog-rn.js — `capture('Application Opened', {…properties, url: initialUrl})`
const APPLICATION_OPENED = "Application Opened";

function isBag(value: unknown): value is EventProps {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// "" has nothing to leak; "$direct" is PostHog's sentinel for "no referrer",
// not a URL, and must survive so direct traffic stays distinguishable.
function scrubUrl(value: string): string {
  return value === "" || value === "$direct" ? value : sanitizeUrl(value);
}

function scrubUrlKeys(bag: EventProps): EventProps {
  const out: EventProps = { ...bag };
  for (const key of URL_PROPERTY_KEYS) {
    const value = out[key];
    if (typeof value === "string") out[key] = scrubUrl(value);
  }
  return out;
}

function scrubProperties(
  properties: EventProps,
  eventName: string,
): EventProps {
  const out = scrubUrlKeys(properties);
  const screenName = out.$screen_name;
  if (typeof screenName === "string") out.$screen_name = screenPath(screenName);
  const deepLink = out.url;
  if (eventName === APPLICATION_OPENED && typeof deepLink === "string") {
    out.url = sanitizeUrl(deepLink);
  }
  if (isBag(out.$set)) out.$set = scrubUrlKeys(out.$set);
  if (isBag(out.$set_once)) out.$set_once = scrubUrlKeys(out.$set_once);
  return out;
}

/**
 * PostHog `before_send` hook: sanitizes the URL-bearing properties of EVERY
 * event (lifecycle, screen, custom) just before it is queued for sending.
 * Fails closed: an event this cannot read is dropped (null), never sent raw.
 */
export const sanitizePosthogEvent: BeforeSendFn = (cr) => {
  if (!cr) return null;
  try {
    const next: CaptureEvent = { ...cr };
    if (cr.properties)
      next.properties = scrubProperties(cr.properties, cr.event);
    if (cr.$set) next.$set = scrubUrlKeys(cr.$set);
    if (cr.$set_once) next.$set_once = scrubUrlKeys(cr.$set_once);
    return next;
  } catch {
    return null;
  }
};

/**
 * Product analytics, wired beside crash reporting. Imported from the root
 * layout (and every helper's import chain), so the client exists before any
 * screen or session code runs.
 *
 * The key is the guard: a developer machine or a build missing
 * `EXPO_PUBLIC_POSTHOG_KEY` gets a full no-op — the same contract as
 * crash-reporting.ts. The project key is write-only and public by design
 * (EXPO_PUBLIC_ values ship inside the binary); nothing else belongs here.
 */
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export const posthogEnabled = Boolean(key);

// One client per JS context: Fast Refresh re-evaluates this module, and a
// second instance would double every event. The global memo survives it.
const globalStore = globalThis as typeof globalThis & {
  __milaPosthog?: PostHog;
};

export const posthogClient: PostHog | null =
  posthogEnabled && key
    ? (globalStore.__milaPosthog ??= new PostHog(key, {
        host,
        // Foreground/background transitions are captured by the SDK. Screen
        // names are captured explicitly from the root layout, matching the
        // web app's manual pageviews.
        captureAppLifecycleEvents: true,
        // Session replay is OFF: its payloads are not scrubbed by the hook.
        // Owner decision: PostHog replay stays off for privacy; Sentry's
        // masked on-error replay covers "see what went wrong".
        // src: posthog-react-native@4.79.0 dist/posthog-rn.d.ts `enableSessionReplay?: boolean` (default false) · 2026-10-07
        enableSessionReplay: false,
        // A cold start from a sign-in or reset link would otherwise send the
        // full deep link, tokens included, on "Application Opened". The hook
        // runs on every captured event, lifecycle ones included.
        // src: posthog-react-native@4.79.0 dist/posthog-rn.d.ts `PostHogOptions extends PostHogCoreOptions`;
        //   @posthog/core@1.57.0 dist/types.d.ts `before_send?: BeforeSendFn | BeforeSendFn[]` and
        //   `BeforeSendFn = (event: CaptureEvent | null) => CaptureEvent | null` · 2026-10-07
        before_send: sanitizePosthogEvent,
      }))
    : null;

if (posthogClient) {
  // Super properties: every event is attributable to this app and build.
  void posthogClient.register({
    app: "mila-mobile",
    environment: __DEV__ ? "development" : "production",
  });
}

/** Captures a product event. No-op when PostHog is unconfigured. */
export function capturePhEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  // The SDK types event properties as JSON; callers pass free-form records
  // (mirroring the web app's helper), so the record is narrowed here.
  void posthogClient?.capture(
    event,
    (properties ?? {}) as Parameters<PostHog["capture"]>[1],
  );
}

/** Associates the device with a signed-in member. No-op when PostHog is unconfigured. */
export function identifyPhUser(userId: string): void {
  void posthogClient?.identify(userId);
}

/** Clears the identified member on sign-out so the next session starts anonymous. No-op when PostHog is unconfigured. */
export function resetPh(): void {
  posthogClient?.reset();
}

/** Captures a screen view for the given router pathname, minus any query or fragment. No-op when PostHog is unconfigured. */
export function captureScreen(pathname: string): void {
  void posthogClient?.screen(screenPath(pathname));
}
