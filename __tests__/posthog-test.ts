import { capturePhEvent, captureScreen, identifyPhUser, posthogClient, posthogEnabled, resetPh } from "@/services/posthog";

test("an unconfigured PostHog is a complete no-op", () => {
  // Jest runs without EXPO_PUBLIC_POSTHOG_KEY (no .env loading), which is
  // exactly the developer-machine / keyless-build case: helpers must be safe
  // to call from anywhere and must not construct a client.
  expect(posthogEnabled).toBe(false);
  expect(posthogClient).toBeNull();
  expect(() => capturePhEvent("signup_completed", { source: "mobile" })).not.toThrow();
  expect(() => identifyPhUser("member-1")).not.toThrow();
  expect(() => resetPh()).not.toThrow();
  expect(() => captureScreen("/login")).not.toThrow();
});
