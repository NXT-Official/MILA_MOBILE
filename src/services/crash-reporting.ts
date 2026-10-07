import { bindSentryUserToAuth } from "./observability/sentry";

/**
 * Crash and error reporting entry point, imported for its side effect as the
 * first service line of the root layout, before any feature code runs, so a
 * crash during font loading or session resolution is still caught.
 *
 * It now delegates to the observability facade's Sentry adapter
 * (`./observability/sentry`, which owns `Sentry.init`, the DSN guard, release,
 * dist, environment, scrubbing, logs and masked replay). Kept as a module so
 * the root layout's import and the file's history stay intact.
 */
bindSentryUserToAuth();
