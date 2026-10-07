import * as mockPh from "@/services/posthog";
import * as mockSentry from "./sentry";
import { captureError, identify, log, reset, track, trackScreen } from "./index";

jest.mock("./sentry", () => ({
  captureError: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
  log: jest.fn(),
  breadcrumb: jest.fn(),
}));
jest.mock("@/services/posthog", () => ({
  capturePhEvent: jest.fn(),
  identifyPhUser: jest.fn(),
  resetPh: jest.fn(),
  captureScreen: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

describe("observability facade", () => {
  it("captureError scrubs the message before it reaches Sentry", () => {
    captureError(new Error("fail for a@b.co"), { area: "look" });
    const [err, ctx] = jest.mocked(mockSentry.captureError).mock.calls[0];
    expect((err as Error).message).toBe("fail for [email]");
    expect(ctx).toEqual({ area: "look" });
  });

  it("captureError keeps going when the SDK throws", () => {
    jest.mocked(mockSentry.captureError).mockImplementationOnce(() => {
      throw new Error("sdk down");
    });
    expect(() => captureError(new Error("x"))).not.toThrow();
  });

  it("track reaches PostHog and survives a failing SDK", () => {
    jest.mocked(mockPh.capturePhEvent).mockImplementationOnce(() => {
      throw new Error("ph down");
    });
    expect(() => track("look_generated", { n: 1 })).not.toThrow();
    track("look_generated", { n: 2 });
    expect(mockPh.capturePhEvent).toHaveBeenLastCalledWith("look_generated", { n: 2 });
  });

  it("identify sets only the user id on Sentry and PostHog", () => {
    identify("u1");
    expect(mockSentry.setUser).toHaveBeenCalledWith("u1");
    expect(mockPh.identifyPhUser).toHaveBeenCalledWith("u1");
  });

  it("reset clears both", () => {
    reset();
    expect(mockSentry.clearUser).toHaveBeenCalled();
    expect(mockPh.resetPh).toHaveBeenCalled();
  });

  it("trackScreen sanitizes the path for Sentry and sends it to PostHog", () => {
    trackScreen("/auth/callback?code=abc#access_token=z");
    expect(mockSentry.breadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: "navigation", data: { to: "/auth/callback" } }),
    );
    expect(mockPh.captureScreen).toHaveBeenCalledWith("/auth/callback?code=abc#access_token=z");
  });

  it("log scrubs the message", () => {
    log.warn("hello a@b.co", { area: "x" });
    expect(mockSentry.log).toHaveBeenCalledWith("warn", "hello [email]", { area: "x" });
  });
});
