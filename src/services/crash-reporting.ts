import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

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

// Ties every crash/event to the exact released build rather than just "the
// app" — release is the app.config.ts version (bumped per store submission);
// dist is the native build number EAS assigns at build time
// (`appVersionSource: "remote"` in eas.json means this isn't known statically
// until the binary exists, so it's read from the running native module
// rather than hardcoded). Falls back to "dev" so a bare `expo start` build
// (no native binary, no EAS-assigned number) doesn't report `undefined`.
const release = `mila-mobile@${Constants.expoConfig?.version ?? "0.0.0"}`;
const dist = Constants.nativeBuildVersion ?? "dev";

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  release,
  dist,
});
