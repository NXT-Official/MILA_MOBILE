import {
  getCrashlytics,
  log as recordBreadcrumb,
  recordError,
  setAttribute,
  setCrashlyticsCollectionEnabled,
  setUserId as setNativeUserId,
  type Crashlytics,
} from "@react-native-firebase/crashlytics";

import { scrubText } from "./scrub";

/**
 * The Crashlytics adapter — the Google-side crash reporter, alongside Sentry.
 *
 * What it adds over Sentry: native crashes and ANRs land in the Firebase
 * console the Play Console links to, with the device/OS breakdown Google
 * already has, and Crashlytics is free on the Spark plan. The two are
 * deliberately independent — one SDK failing or being unconfigured never
 * affects the other, and neither can take the app down.
 *
 * v26 is a *modular* API: `getCrashlytics()` returns a handle and every
 * operation is a module-level function taking that handle. There is no default
 * export — `import crashlytics from "@react-native-firebase/crashlytics"` is a
 * compile-time TS1192 and a runtime `undefined`.
 *
 * Fail closed: without the native module (a JS-only test run, or a build
 * without `google-services.json`) every call below is a no-op rather than a
 * throw. `google-services.json` is committed at the repo root and wired through
 * `app.config.ts`, so a release build always has the config.
 *
 * What it must NOT carry: nothing personal. Context values are scrubbed with
 * the same `scrubText` the other adapters use, and only the Supabase user id is
 * ever attached — never an email or a name.
 *
 * src: https://rnfirebase.io/crashlytics/usage · @react-native-firebase 26.4.0 · 2026-10-09
 */

/**
 * Reporting belongs to installed builds only. A debug build's errors are
 * already on the developer's screen, and shipping them would spend the free
 * tier on noise nobody triages. Exported and pure so the policy is testable
 * without re-importing the module under a doctored `__DEV__`.
 */
export function shouldCollect(isDev: boolean): boolean {
  return !isDev;
}

const collectionEnabled = shouldCollect(__DEV__);

let cached: Crashlytics | null | undefined;

/**
 * Swallows a rejection. `setUserId`/`setAttribute`/`setCrashlyticsCollectionEnabled`
 * are promise-returning in v26: a rejection here would surface as an unhandled
 * promise rejection in the app's own logs, which is exactly the noise this
 * adapter exists to avoid.
 */
function ignore(result: unknown): void {
  if (result && typeof (result as Promise<unknown>).catch === "function") {
    void (result as Promise<unknown>).catch(() => {});
  }
}

/**
 * The handle, or null when there is no native module to talk to. Cached because
 * `getCrashlytics()` re-resolves the native module on every call.
 */
function instance(): Crashlytics | null {
  if (!collectionEnabled) return null;
  if (cached !== undefined) return cached;
  try {
    const created = getCrashlytics();
    ignore(setCrashlyticsCollectionEnabled(created, true));
    cached = created;
  } catch {
    // No native module: a test run, or a build that predates the Firebase
    // config. Observability must never be the thing that takes the app down.
    cached = null;
  }
  return cached;
}

/** Attributes Crashlytics accepts: short, non-personal strings. */
export function attributes(context?: Record<string, string>): Record<string, string> {
  if (!context) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(context)) {
    if (typeof value !== "string") continue;
    out[key] = scrubText(value).slice(0, 100);
  }
  return out;
}

/** Records an error. Crashlytics' non-fatal channel, mirroring `captureError`. */
export function captureError(error: unknown, context?: Record<string, string>): void {
  const c = instance();
  if (!c) return;
  try {
    for (const [key, value] of Object.entries(attributes(context))) {
      ignore(setAttribute(c, key, value));
    }
    recordError(
      c,
      error instanceof Error
        ? new Error(scrubText(error.message))
        : new Error(scrubText(String(error))),
    );
  } catch {
    // ignored — see `instance`.
  }
}

/** Associates the device with a member: the user id, and nothing else. */
export function setUser(userId: string): void {
  const c = instance();
  if (!c) return;
  try {
    ignore(setNativeUserId(c, userId));
  } catch {
    // ignored — see `instance`.
  }
}

/** Clears the identified member (sign-out). */
export function clearUser(): void {
  setUser("");
}

/** A breadcrumb line, attached to whatever crash follows it. */
export function log(
  level: "info" | "warn" | "error",
  message: string,
  extra?: Record<string, string | number | boolean>,
): void {
  const c = instance();
  if (!c) return;
  try {
    const suffix = extra
      ? ` ${Object.entries(extra)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}`
      : "";
    recordBreadcrumb(c, `${level}: ${scrubText(message)}`.slice(0, 200) + suffix.slice(0, 200));
  } catch {
    // ignored — see `instance`.
  }
}
