/**
 * The `jest.fn()`s are created **inside** the factory, not outside it.
 * `jest.mock` is hoisted above the imports, and the factory runs the moment
 * `client.ts` is first required — which is earlier than any `const` in this
 * file initialises. Referencing an outer binding here wires `undefined` in and
 * every test fails with "getSession is not a function".
 *
 * Paths are relative because the `@/` alias is a babel transform that rewrites
 * import statements, not `jest.mock` string arguments.
 */
jest.mock("../src/services/supabase/client", () => ({
  supabase: { auth: { getSession: jest.fn(), refreshSession: jest.fn() } },
}));

// `client.ts` reads `env` at import time, which throws when the four
// EXPO_PUBLIC_* values are absent. Mocking the module keeps the test
// independent of whether a .env.local happens to exist.
jest.mock("../src/constants/env", () => ({
  env: {
    API_BASE_URL: "https://api.test",
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable",
    HCAPTCHA_SITEKEY: "sitekey",
  },
}));

import { ApiError, api } from "@/services/api/client";
import { supabase } from "@/services/supabase/client";

const mockGetSession = supabase.auth.getSession as unknown as jest.Mock;
const mockRefreshSession = supabase.auth.refreshSession as unknown as jest.Mock;

/**
 * Every branch of the fetch client. This module decides whether a member sees
 * the paywall or a dead end, and until now it had no test at all.
 */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function errorBody(code: string, message = "nope", retryAfter?: number) {
  return { error: { code, message, retryAfter } };
}

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { access_token: "token-1" } } });
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("request shape", () => {
  it("sends the bearer token and JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await api.post("/thing", { a: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/thing");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-1");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("omits Authorization when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await api.get("/thing");

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("sends no body on GET", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.get("/thing");
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });
});

describe("error mapping", () => {
  // The §6 taxonomy. A code the client cannot name becomes INTERNAL, never a
  // blank screen.
  const CODES = [
    "INSUFFICIENT_CREDITS",
    "RATE_LIMITED",
    "AI_UNAVAILABLE",
    "ACCOUNT_SUSPENDED",
    "UNAUTHENTICATED",
    "VALIDATION_FAILED",
    "FORBIDDEN",
    "INTERNAL",
  ];

  it.each(CODES)("surfaces %s as an ApiError carrying that code", async (code) => {
    fetchMock.mockResolvedValue(jsonResponse(400, errorBody(code)));

    await expect(api.post("/thing")).rejects.toMatchObject({ code, status: 400 });
  });

  it("carries retryAfter through for a rate limit", async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, errorBody("RATE_LIMITED", "slow down", 90)));

    await expect(api.post("/thing")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfter: 90,
    });
  });

  it("falls back to INTERNAL when the body is not the expected shape", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(api.post("/thing")).rejects.toMatchObject({ code: "INTERNAL", status: 500 });
  });
});

describe("the 401 refresh path", () => {
  it("refreshes once and replays the request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, errorBody("UNAUTHENTICATED")))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: "token-2" } } });

    await expect(api.post("/thing")).resolves.toEqual({ ok: true });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cannot loop — a second 401 after refreshing is thrown, not retried again", async () => {
    // A refresh loop on a dead refresh token is how an app ends up hammering
    // auth while showing a blank screen.
    fetchMock.mockResolvedValue(jsonResponse(401, errorBody("UNAUTHENTICATED")));
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: "token-2" } } });

    await expect(api.post("/thing")).rejects.toBeInstanceOf(ApiError);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up when the refresh itself fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, errorBody("UNAUTHENTICATED")));
    mockRefreshSession.mockResolvedValue({ data: { session: null } });

    await expect(api.post("/thing")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("transport failures", () => {
  /**
   * A timeout arrives as an abort, indistinguishable from a dead socket unless
   * the signal is checked. They carry different copy on purpose: "check your
   * connection" is wrong and slightly insulting when the request was fine and
   * the model was simply slow.
   */
  it("reports an aborted request as TIMEOUT", async () => {
    fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });

    const pending = api.post("/thing", undefined, { timeoutMs: 10 });
    await expect(pending).rejects.toMatchObject({ code: "TIMEOUT", status: 0 });
  });

  it("reports a dead socket as NETWORK", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    await expect(api.post("/thing")).rejects.toMatchObject({ code: "NETWORK", status: 0 });
  });
});
