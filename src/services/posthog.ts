import PostHog from "posthog-react-native";

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
const globalStore = globalThis as typeof globalThis & { __milaPosthog?: PostHog };

export const posthogClient: PostHog | null =
  posthogEnabled && key
    ? (globalStore.__milaPosthog ??= new PostHog(key, {
        host,
        // Foreground/background transitions are captured by the SDK. Screen
        // names are captured explicitly from the root layout, matching the
        // web app's manual pageviews.
        captureAppLifecycleEvents: true,
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
export function capturePhEvent(event: string, properties?: Record<string, unknown>): void {
  // The SDK types event properties as JSON; callers pass free-form records
  // (mirroring the web app's helper), so the record is narrowed here.
  void posthogClient?.capture(event, (properties ?? {}) as Parameters<PostHog["capture"]>[1]);
}

/** Associates the device with a signed-in member. No-op when PostHog is unconfigured. */
export function identifyPhUser(userId: string): void {
  void posthogClient?.identify(userId);
}

/** Clears the identified member on sign-out so the next session starts anonymous. No-op when PostHog is unconfigured. */
export function resetPh(): void {
  posthogClient?.reset();
}

/** Captures a screen view for the given router pathname. No-op when PostHog is unconfigured. */
export function captureScreen(pathname: string): void {
  void posthogClient?.screen(pathname);
}
