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

// Query params that carry a credential, a one-time code, a return path or an
// address: sign-in (?code=, ?token_hash=&type=), the implicit-flow session
// (#access_token=, dropped with the whole fragment), password reset, and the
// app's own ?redirect= return path. Compared lower-cased and percent-decoded.
const SENSITIVE_PARAMS: ReadonlySet<string> = new Set([
  "code",
  "token",
  "token_hash",
  "access_token",
  "refresh_token",
  "type",
  "redirect",
  "next",
  "email",
  "error_description",
]);

function paramName(pair: string): string {
  const raw = pair.split("=")[0] ?? "";
  try {
    return decodeURIComponent(raw.replace(/\+/g, " ")).toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

// Filters the raw query string so surviving params keep their exact encoding.
function keptQuery(query: string): string {
  const kept = query
    .replace(/^\?/, "")
    .split("&")
    .filter((pair) => pair !== "" && !SENSITIVE_PARAMS.has(paramName(pair)));
  return kept.length > 0 ? `?${kept.join("&")}` : "";
}

// scheme://authority/path — the shape of every deep link and universal link.
const HIERARCHICAL_URL = /^([a-z][a-z0-9+.-]*:\/\/)([^/]*)(.*)$/i;

/**
 * Strips everything from a URL that must never reach analytics: the whole
 * fragment, every sensitive query param and embedded credentials (userinfo).
 * Accepts `scheme://…` URLs (deep links such as `mila://auth/callback`, and
 * universal links) and bare paths; anything else, including `mailto:`, becomes
 * a fixed placeholder. Pure string work on purpose: Hermes' built-in `URL` does
 * not implement `search`/`searchParams`, and this runs before any polyfill.
 */
export function sanitizeUrl(url: string): string {
  const hashAt = url.indexOf("#");
  const withoutFragment = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = withoutFragment.indexOf("?");
  const head =
    queryAt === -1 ? withoutFragment : withoutFragment.slice(0, queryAt);
  const query = queryAt === -1 ? "" : withoutFragment.slice(queryAt);

  if (head.startsWith("/") && !head.startsWith("//"))
    return `${head}${keptQuery(query)}`;

  const match = HIERARCHICAL_URL.exec(head);
  if (!match) return UNPARSEABLE_URL;
  const scheme = match[1] ?? "";
  const host = (match[2] ?? "").replace(/^.*@/, "");
  const path = match[3] ?? "";
  if (host === "" && path === "") return UNPARSEABLE_URL;
  return `${scheme}${host}${path}${keptQuery(query)}`;
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
