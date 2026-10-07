import { ApiError } from "@/services/api/errors";
import { reportQueryError } from "./query-errors";

const mockCapture = jest.fn();
jest.mock("./index", () => ({ captureError: (...a: unknown[]) => mockCapture(...a) }));

beforeEach(() => mockCapture.mockClear());

describe("reportQueryError", () => {
  it("reports an unexpected error with the query area only, never the full key", () => {
    reportQueryError(new Error("boom"), { kind: "query", key: ["profile", "user-123"] });
    expect(mockCapture).toHaveBeenCalledWith(expect.any(Error), {
      source: "query",
      key: "profile",
    });
  });

  it("reports server failures", () => {
    reportQueryError(new ApiError("INTERNAL", "x", 500), { kind: "mutation" });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it.each(["INSUFFICIENT_CREDITS", "RATE_LIMITED", "UNAUTHENTICATED", "ACCOUNT_SUSPENDED", "VALIDATION_FAILED", "NETWORK", "TIMEOUT"])(
    "does not report the expected %s outcome",
    (code) => {
      reportQueryError(new ApiError(code, "x", 0), { kind: "query", key: ["a"] });
      expect(mockCapture).not.toHaveBeenCalled();
    },
  );
});
