import * as firebaseCrashlytics from "@react-native-firebase/crashlytics";

import * as adapter from "./crashlytics";

/**
 * The Crashlytics adapter's contract: a debug run never reports, a release run
 * reports through the native module, and nothing personal rides along.
 *
 * v26's API is modular — `getCrashlytics()` plus per-operation functions that
 * take the handle — so the assertions are on those module-level calls.
 */

const native = firebaseCrashlytics as unknown as {
  getCrashlytics: jest.Mock;
  recordError: jest.Mock;
  log: jest.Mock;
  setAttribute: jest.Mock;
  setUserId: jest.Mock;
  setCrashlyticsCollectionEnabled: jest.Mock;
};

/** The module as a release build loads it — `__DEV__` false at import time. */
function releaseModule(): typeof adapter {
  const g = globalThis as unknown as { __DEV__?: boolean };
  const previous = g.__DEV__;
  g.__DEV__ = false;
  let mod: typeof adapter | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<typeof adapter>("./crashlytics");
  });
  g.__DEV__ = previous;
  expect(mod).toBeDefined();
  return mod as typeof adapter;
}

describe("crashlytics collection policy", () => {
  it("collects in a release build and never in a debug one", () => {
    expect(adapter.shouldCollect(false)).toBe(true);
    expect(adapter.shouldCollect(true)).toBe(false);
  });
});

describe("crashlytics adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is a no-op under a debug `__DEV__`, so a dev machine's noise stays local", () => {
    adapter.captureError(new Error("boom"), { route: "/saved" });
    adapter.setUser("u1");
    adapter.clearUser();
    adapter.log("error", "boom");

    expect(native.getCrashlytics).not.toHaveBeenCalled();
    expect(native.recordError).not.toHaveBeenCalled();
    expect(native.log).not.toHaveBeenCalled();
  });

  it("enables collection once and reports through the same handle", () => {
    const release = releaseModule();

    release.log("info", "started");
    release.captureError(new Error("plain failure"), { route: "/saved" });

    expect(native.getCrashlytics).toHaveBeenCalledTimes(1);
    const handle = native.getCrashlytics.mock.results[0]?.value;
    expect(native.setCrashlyticsCollectionEnabled).toHaveBeenCalledWith(handle, true);
    expect(native.log).toHaveBeenCalledWith(handle, "info: started");
    expect(native.recordError).toHaveBeenCalledTimes(1);
    expect(native.setAttribute).toHaveBeenCalledWith(handle, "route", "/saved");
  });

  it("scrubs personal data out of the message and the attributes", () => {
    const release = releaseModule();

    release.captureError(new Error("failed for a@b.co"), { member: "a@b.co" });

    const reported = native.recordError.mock.calls[0]?.[1] as Error;
    expect(reported).toBeInstanceOf(Error);
    expect(reported.message).not.toContain("a@b.co");
    expect(native.setAttribute).toHaveBeenCalledWith(
      expect.anything(),
      "member",
      expect.not.stringContaining("a@b.co"),
    );
  });

  it("attaches the member id and clears it on sign-out", () => {
    const release = releaseModule();

    release.setUser("u9");
    release.clearUser();

    const handle = native.getCrashlytics.mock.results[0]?.value;
    expect(native.setUserId).toHaveBeenNthCalledWith(1, handle, "u9");
    expect(native.setUserId).toHaveBeenNthCalledWith(2, handle, "");
  });

  it("survives a native module that throws (a build without Firebase config)", () => {
    native.getCrashlytics.mockImplementationOnce(() => {
      throw new Error("You attempted to use a firebase module that's not installed");
    });
    const release = releaseModule();

    expect(() => {
      release.captureError(new Error("boom"));
      release.setUser("u1");
      release.log("warn", "boom");
    }).not.toThrow();
    expect(native.recordError).not.toHaveBeenCalled();
  });
});
