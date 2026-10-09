import * as Sentry from "@sentry/react-native";

import { useAuthStore } from "@/stores/auth-store";

import { bindSentryUserToAuth, isUsableDsn } from "./sentry";

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  mobileReplayIntegration: jest.fn((o: unknown) => ({ name: "Replay", opts: o })),
}));

describe("sentry adapter", () => {
  it("is disabled without a DSN and masks replay", () => {
    const opts = jest.mocked(Sentry.init).mock.calls[0]?.[0];
    expect(opts?.enabled).toBe(false);
    expect(opts?.dsn).toBeUndefined();
    expect(opts?.sendDefaultPii).toBe(false);
    expect(opts?.enableLogs).toBe(true);
    expect(opts?.replaysSessionSampleRate).toBe(0);
    expect(opts?.replaysOnErrorSampleRate).toBe(1);
    expect(Sentry.mobileReplayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      maskAllImages: true,
      maskAllVectors: true,
    });
  });

  it("scrubs events before send", () => {
    const opts = jest.mocked(Sentry.init).mock.calls[0]?.[0];
    const out = opts?.beforeSend?.({ type: undefined, message: "a@b.co", user: { id: "u", email: "a@b.co" } }, {});
    expect(out).toMatchObject({ message: "[email]", user: { id: "u" } });
  });

  it("sets the user id from the auth store and clears on sign-out", () => {
    const unbind = bindSentryUserToAuth();
    useAuthStore.setState({ session: { user: { id: "u9" } } as never });
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: "u9" });
    useAuthStore.setState({ session: null });
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
    unbind();
  });

  /**
   * The DSN is read once at import, so the guard is exercised directly rather
   * than by re-importing the module with a doctored environment.
   */
  it("switches on only for a well-formed DSN", () => {
    for (const wellFormed of [
      "https://***@o4505.ingest.sentry.io/4505",
      "http://***@127.0.0.1:9000/7",
      "  https://***@o4505.ingest.sentry.io/4505  ",
    ]) {
      expect(isUsableDsn(wellFormed)).toBe(true);
    }

    for (const malformed of [
      undefined,
      "",
      "   ",
      "https://o4505.ingest.sentry.io/4505", // public key stripped
      "https://***@o4505.ingest.sentry.io", // no project id
      "https://***@o4505.ingest.sentry.io/not-a-number",
      "https://***@", // no host
      "o4505.ingest.sentry.io/4505",
      "not-a-url",
    ]) {
      expect(isUsableDsn(malformed)).toBe(false);
    }
  });
});
