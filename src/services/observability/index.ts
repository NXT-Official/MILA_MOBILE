import { capturePhEvent, captureScreen, identifyPhUser, resetPh } from "@/services/posthog";

import * as crashlytics from "./crashlytics";
import * as sentry from "./sentry";
import { scrubPath, scrubText } from "./scrub";

/**
 * The observability facade: the one place feature and service code reports
 * errors, logs, events and screen views. Each SDK is wrapped on its own, so
 * one failing or unconfigured SDK never breaks the others or the caller, and
 * every SDK is a no-op when its env var is unset (Sentry: EXPO_PUBLIC_SENTRY_DSN,
 * PostHog: EXPO_PUBLIC_POSTHOG_KEY) or its native module is absent (Crashlytics).
 *
 * Crashlytics is installed for the Google side (native crashes in the Firebase
 * console the Play Console links to). Firebase Analytics is still intentionally
 * not installed — when it is wanted, add `@react-native-firebase/analytics`
 * behind one more `safely` entry here and update the Play data-safety form.
 */

function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    // Observability must never take the app down.
  }
}

function scrubbedError(error: unknown): unknown {
  if (error instanceof Error) {
    const copy = new Error(scrubText(error.message));
    copy.name = error.name;
    copy.stack = error.stack ? scrubText(error.stack) : undefined;
    return copy;
  }
  return typeof error === "string" ? scrubText(error) : error;
}

/** Reports an error. `context` becomes searchable tags; keep values short and non-personal. */
export function captureError(error: unknown, context?: Record<string, string>): void {
  safely(() => sentry.captureError(scrubbedError(error), context));
  safely(() => crashlytics.captureError(scrubbedError(error), context));
}

/** Product event (PostHog). */
export function track(event: string, properties?: Record<string, unknown>): void {
  safely(() => capturePhEvent(event, properties));
}

/** Associates the device with a member: user id only, never email or name. */
export function identify(userId: string): void {
  safely(() => sentry.setUser(userId));
  safely(() => crashlytics.setUser(userId));
  safely(() => identifyPhUser(userId));
}

/** Clears the identified member (sign-out). */
export function reset(): void {
  safely(() => sentry.clearUser());
  safely(() => crashlytics.clearUser());
  safely(() => resetPh());
}

/** Screen view for a router pathname. Sentry gets a sanitized breadcrumb; PostHog sanitizes in its own hook. */
export function trackScreen(pathname: string): void {
  safely(() =>
    sentry.breadcrumb({
      category: "navigation",
      message: "screen view",
      data: { to: scrubPath(pathname) },
      level: "info",
    }),
  );
  safely(() => captureScreen(pathname));
}

type LogAttributes = Record<string, string | number | boolean>;

function send(level: "info" | "warn" | "error", message: string, attributes?: LogAttributes): void {
  safely(() => sentry.log(level, scrubText(message), attributes));
  safely(() => crashlytics.log(level, scrubText(message), attributes));
}

export const log = {
  info: (message: string, attributes?: LogAttributes) => send("info", message, attributes),
  warn: (message: string, attributes?: LogAttributes) => send("warn", message, attributes),
  error: (message: string, attributes?: LogAttributes) => send("error", message, attributes),
};
