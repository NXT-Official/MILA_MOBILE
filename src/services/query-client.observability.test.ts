import { queryClient } from "./query-client";

const mockReport = jest.fn();
jest.mock("@/services/observability/query-errors", () => ({
  reportQueryError: (...a: unknown[]) => mockReport(...a),
}));
jest.mock("./api/client", () => {
  const { ApiError } = jest.requireActual("./api/errors");
  return { ApiError, NON_RETRYABLE_CODES: [] };
});

describe("queryClient error hooks", () => {
  it("reports query failures", () => {
    const err = new Error("q");
    queryClient.getQueryCache().config.onError?.(err, { queryKey: ["history"] } as never);
    expect(mockReport).toHaveBeenCalledWith(err, { kind: "query", key: ["history"] });
  });

  it("reports mutation failures", () => {
    const err = new Error("m");
    queryClient.getMutationCache().config.onError?.(err, undefined, undefined, {} as never, {} as never);
    expect(mockReport).toHaveBeenCalledWith(err, { kind: "mutation" });
  });
});
