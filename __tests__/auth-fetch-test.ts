/**
 * `createSupabaseFetch` in `services/supabase/auth-fetch.ts`: the fetch the
 * Supabase client is given as `global.fetch`.
 *
 * auth-js deletes the stored session when a refresh fails with an error it
 * does not classify as retryable and the access token has already expired. A
 * captive portal (hotel or airport Wi-Fi) answering 511 or 403 with an HTML
 * page, or a proxy answering 407 or 429, is classified that way, so the token
 * was deleted although the auth server never rejected it. The wrapper turns
 * those replies into the network failure they are; auth-js then keeps the
 * session and retries. It also puts a deadline on auth requests, because a
 * stalled connection on Android can otherwise hold a refresh open for minutes.
 *
 * Everything that is not an auth request passes through untouched.
 */
import { AUTH_REQUEST_TIMEOUT_MS, createSupabaseFetch } from "@/services/supabase/auth-fetch";

const PROJECT = "https://project.supabase.test";
const TOKEN = `${PROJECT}/auth/v1/token?grant_type=refresh_token`;

const baseFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
const supabaseFetch = createSupabaseFetch(PROJECT, { baseFetch });

function respond(body: string | null, status: number, contentType = "application/json") {
  return new Response(body, { status, headers: { "Content-Type": contentType } });
}

const PORTAL_PAGE = "<!doctype html><title>Sign in to the Wi-Fi</title>";

beforeEach(() => baseFetch.mockReset());

describe("refresh-token replies that did not come from the auth server", () => {
  it.each([
    ["a captive portal page with 200", 200, PORTAL_PAGE, "text/html"],
    ["a captive portal page with 511", 511, PORTAL_PAGE, "text/html"],
    ["a captive portal page with 403", 403, PORTAL_PAGE, "text/html"],
    ["a proxy asking for credentials (407)", 407, PORTAL_PAGE, "text/html"],
    ["a proxy timeout (408)", 408, "", "text/plain"],
    ["a rate limit (429), even as JSON", 429, '{"code":429,"error_code":"over_request_rate_limit","msg":"Too many requests"}', "application/json"],
    ["an empty body", 200, "", "application/json"],
  ])("%s fails as a network error", async (_name, status, body, type) => {
    baseFetch.mockResolvedValue(respond(body, status, type));
    await expect(supabaseFetch(TOKEN, { method: "POST" })).rejects.toBeInstanceOf(TypeError);
  });
});

describe("replies from the auth server pass through", () => {
  it("a revoked refresh token (400 invalid_grant) reaches auth-js, so she is signed out", async () => {
    const body = '{"code":400,"error_code":"refresh_token_not_found","msg":"Invalid Refresh Token: Refresh Token Not Found"}';
    baseFetch.mockResolvedValue(respond(body, 400));

    const response = await supabaseFetch(TOKEN, { method: "POST" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(JSON.parse(body));
  });

  it("a legacy invalid_grant error reaches auth-js too", async () => {
    const body = '{"error":"invalid_grant","error_description":"Invalid Refresh Token"}';
    baseFetch.mockResolvedValue(respond(body, 400));
    const response = await supabaseFetch(TOKEN, { method: "POST" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(JSON.parse(body));
  });

  it("a fresh session comes through intact, headers included", async () => {
    const body = '{"access_token":"a","refresh_token":"r","expires_in":3600}';
    baseFetch.mockResolvedValue(
      new Response(body, { status: 200, headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" } }),
    );

    const response = await supabaseFetch(TOKEN, { method: "POST" });

    expect(response.ok).toBe(true);
    expect(response.headers.get("X-Supabase-Api-Version")).toBe("2024-01-01");
    expect(await response.json()).toEqual(JSON.parse(body));
  });

  it("a JSON 5xx from the auth server stays a 5xx: auth-js already retries those", async () => {
    baseFetch.mockResolvedValue(respond('{"code":500,"msg":"Internal error"}', 500));
    const response = await supabaseFetch(TOKEN, { method: "POST" });
    expect(response.status).toBe(500);
  });

  it("a gateway's HTML error page fails as a network error, whatever its 5xx code", async () => {
    // auth-js retries a non-JSON 500-504 / 520-530 itself, but a 505-519 page
    // would be fatal there; failing every non-JSON reply alike covers both.
    for (const status of [502, 508]) {
      baseFetch.mockResolvedValue(respond("<html>Gateway error</html>", status, "text/html"));
      await expect(supabaseFetch(TOKEN, { method: "POST" })).rejects.toBeInstanceOf(TypeError);
    }
  });

  it("other auth endpoints are not held to the token rules (sign-out answers 204 with no body)", async () => {
    baseFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const response = await supabaseFetch(`${PROJECT}/auth/v1/logout?scope=local`, { method: "POST" });
    expect(response.status).toBe(204);
  });
});

describe("a deadline on auth requests", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** A request that never answers until its signal aborts it. */
  function stall(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
    });
  }

  it("aborts a stalled auth request so auth-js can retry", async () => {
    baseFetch.mockImplementation(stall);
    const request = supabaseFetch(TOKEN, { method: "POST" });
    const outcome = expect(request).rejects.toThrow();

    await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    await outcome;
  });

  it("also covers a body that stalls after the headers arrive", async () => {
    baseFetch.mockImplementation(async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(new Error("Aborted")));
        },
      });
      return new Response(body, { status: 200 });
    });
    const request = supabaseFetch(TOKEN, { method: "POST" });
    const outcome = expect(request).rejects.toThrow();

    await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    await outcome;
  });

  it("does not abort an auth request that answers in time", async () => {
    baseFetch.mockResolvedValue(respond('{"ok":true}', 200));
    await expect(supabaseFetch(TOKEN, { method: "POST" })).resolves.toBeInstanceOf(Response);
    expect(baseFetch.mock.calls[0][1]?.signal?.aborted).toBe(false);
  });

  it("still honours the caller's own abort", async () => {
    baseFetch.mockImplementation(stall);
    const caller = new AbortController();
    const request = supabaseFetch(TOKEN, { method: "POST", signal: caller.signal });
    const outcome = expect(request).rejects.toThrow();

    caller.abort();
    await outcome;
  });
});

describe("everything else", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("passes database, storage and other hosts through untouched, with no deadline", async () => {
    const original = respond(PORTAL_PAGE, 511, "text/html");
    baseFetch.mockResolvedValue(original);

    for (const url of [
      `${PROJECT}/rest/v1/profiles?select=*`,
      `${PROJECT}/storage/v1/object/avatars/member.jpg`,
      "https://api.mila.test/api/v1/look",
      "https://elsewhere.test/auth/v1/token?grant_type=refresh_token",
    ]) {
      const init = { method: "POST" };
      await expect(supabaseFetch(url, init)).resolves.toBe(original);
      expect(baseFetch).toHaveBeenLastCalledWith(url, init);
    }
  });
});
