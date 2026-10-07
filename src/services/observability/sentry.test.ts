import * as Sentry from "@sentry/react-native";

import { useAuthStore } from "@/stores/auth-store";

import { bindSentryUserToAuth } from "./sentry";

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
});
