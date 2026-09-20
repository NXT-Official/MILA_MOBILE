import * as Sentry from "@sentry/react-native";

/**
 * Crash and error reporting, wired at the earliest point of app startup —
 * this module is imported for its side effect as the first line of the root
 * layout, before any feature code runs, so a crash during font loading or
 * session resolution is still caught.
 *
 * `enabled` is the whole guard: a developer machine or a build missing
 * `EXPO_PUBLIC_SENTRY_DSN` gets a no-op client rather than a startup crash
 * from `Sentry.init` reaching for a DSN that was never configured. There is
 * no dev/prod branch beyond that — whether reporting is live is entirely a
 * function of whether a DSN was supplied.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
});
