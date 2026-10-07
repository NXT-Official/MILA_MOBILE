import PostHog, { type PostHogOptions } from "posthog-react-native";

import {
  maskEmails,
  sanitizeScreenPath,
  sanitizeUrl,
} from "./observability/url-sanitize";

// The hook's types come from the SDK's own options so they cannot drift from
// the installed version. `before_send` accepts one function or an array.
type BeforeSendFn = Exclude<
  NonNullable<PostHogOptions["before_send"]>,
  readonly unknown[]
>;
type CaptureEvent = NonNullable<Parameters<BeforeSendFn>[0]>;
type EventProps = NonNullable<CaptureEvent["properties"]>;

export { sanitizeUrl };

// A screen name is a router pathname: query, fragment and id-like segments are
// dropped or masked (shared with the Sentry breadcrumb path).
const screenPath = sanitizeScreenPath;

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

// http(s) and mila:// strings are URLs wherever they appear.
const URL_VALUE = /^(?:https?|mila):\/\/\S+$/i;
const MAX_VALUE_DEPTH = 6;

// Scrubs every string in a property value: a URL goes through the sanitizer,
// anything else only has emails masked. Fails closed past the depth limit.
function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === "string")
    return URL_VALUE.test(value)
      ? maskEmails(sanitizeUrl(value))
      : maskEmails(value);
  if (typeof value !== "object" || value === null) return value;
  if (depth >= MAX_VALUE_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = scrubValue(v, depth + 1);
  return out;
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
  const out = scrubUrlKeys(scrubValue(properties, 0) as EventProps);
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
