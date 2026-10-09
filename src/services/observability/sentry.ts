import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

import { useAuthStore } from "@/stores/auth-store";

import { scrubSentryEvent } from "./scrub";

/**
 * The Sentry adapter. Fail closed: no DSN means `enabled: false`, so every call
 * below is a no-op on a developer machine or a build without one.
 *
 * Privacy: `sendDefaultPii` stays off, `user` carries the Supabase user id and
 * nothing else, every event, breadcrumb and log goes through `scrub.ts`, and
 * session replay masks all text, images and vectors (0% of sessions, 100% of
 * sessions that hit an error).
 *
 * Source maps: the `@sentry/react-native/expo` config plugin (app.config.ts)
 * uploads them. Metro's `getSentryExpoConfig` is not used because metro.config.js
 * does not use it today.
 *
 * src: https://docs.sentry.io/platforms/react-native/ · @sentry/react-native ~7.11.0 · 2026-10-07
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * `enabled` used to be `Boolean(dsn)`, so a half-configured value — a DSN whose
 * public key was stripped, or a bare project URL — left the SDK switched on and
 * every capture failed inside its own pipeline (see the predecessor of this
 * file, crash-reporting.ts, for the reports that came out of it). Only a
 * well-formed DSN, public key and project id included, turns reporting on.
 * src: https://docs.sentry.io/platforms/react-native/configuration/options/#dsn
 */
const DSN_PATTERN = /^https?:\/\/[^@\s/]+@[^/\s?#]+\/\d+$/;

/**
 * True only for a DSN the SDK can actually deliver to: scheme, public key,
 * host and a numeric project id. Exported so the guard is testable without
 * re-importing the module with a doctored environment.
 */
export function isUsableDsn(value: string | undefined): value is string {
  return typeof value === "string" && DSN_PATTERN.test(value.trim());
}

const reportingEnabled = isUsableDsn(dsn);

// Ties every event to the exact released build (see git history of this file's
// predecessor, crash-reporting.ts, for why dist is read at runtime).
const release = `mila-mobile@${Constants.expoConfig?.version ?? "0.0.0"}`;
const dist = Constants.nativeBuildVersion ?? "dev";
const environment =
  process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? "development" : "production");

// Replay is native-backed; where the integration is unavailable (a test double,
// a runtime without the native module) init proceeds without it rather than
// throwing at startup.
function replayIntegrations() {
  if (typeof Sentry.mobileReplayIntegration !== "function") return [];
  return [
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
      maskAllVectors: true,
    }),
  ];
}

Sentry.init({
  dsn: reportingEnabled ? dsn?.trim() : undefined,
  enabled: reportingEnabled,
  release,
  dist,
  environment,
  sendDefaultPii: false,
  enableLogs: true,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  integrations: replayIntegrations(),
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubSentryEvent(breadcrumb),
  beforeSendLog: (entry) => scrubSentryEvent(entry),
});

export function captureError(error: unknown, context?: Record<string, string>): void {
  Sentry.captureException(error, context ? { tags: context } : undefined);
}

export function setUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

export function clearUser(): void {
  Sentry.setUser(null);
}

export function log(
  level: "info" | "warn" | "error",
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  if (level === "info") Sentry.logger.info(message, attributes);
  else if (level === "warn") Sentry.logger.warn(message, attributes);
  else Sentry.logger.error(message, attributes);
}

export function breadcrumb(crumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(crumb);
}

/**
 * Mirrors the auth store's session into Sentry's user (id only). Lives here, not
 * in the auth listener, so the auth files stay untouched. Returns the unsubscribe.
 */
export function bindSentryUserToAuth(): () => void {
  const apply = (userId: string | undefined) => (userId ? setUser(userId) : clearUser());
  apply(useAuthStore.getState().session?.user.id);
  return useAuthStore.subscribe((state, prev) => {
    const id = state.session?.user.id;
    if (id !== prev.session?.user.id) apply(id);
  });
}
