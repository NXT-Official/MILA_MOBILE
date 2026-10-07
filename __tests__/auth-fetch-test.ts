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
import {
  AUTH_REQUEST_TIMEOUT_MS,
  AUTH_WRITE_TIMEOUT_MS,
  createSupabaseFetch,
} from "@/services/supabase/auth-fetch";

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
    baseFetch.mockResolvedValue(respond('{"access_token":"a","refresh_token":"r","expires_in":3600}', 200));
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

describe("JSON replies to the token request that did not come from the auth server", () => {
  // auth-js turns a JSON 4xx into a fatal AuthApiError and a 2xx without a
  // session into AuthSessionMissingError, and either deletes the session.
  // src: node_modules/@supabase/auth-js/dist/module/lib/fetch.js `handleError`, `hasSession` · 2.112.2
  it.each([
    ["a 200 that is not a session", 200, '{"status":"login_required"}'],
    ["a 200 with JSON null", 200, "null"],
    ["the gateway's 401 Invalid API key", 401, '{"message":"Invalid API key","hint":"Double check your Supabase `anon` or `service_role` API key."}'],
    ["a firewall's JSON 403", 403, '{"error":"Forbidden"}'],
    ["a 400 with no auth error code", 400, '{"msg":"Bad request"}'],
    ["a 505 with no auth error code", 505, '{"message":"HTTP version not supported"}'],
  ])("%s fails as a network error", async (_name, status, body) => {
    baseFetch.mockResolvedValue(respond(body, status));
    await expect(supabaseFetch(TOKEN, { method: "POST" })).rejects.toBeInstanceOf(TypeError);
  });

  it.each([
    [
      "a revoked session (session_not_found, current API shape)",
      403,
      '{"code":"session_not_found","message":"Session from session_id claim in JWT does not exist"}',
    ],
    [
      "a reused refresh token (refresh_token_already_used, current API shape)",
      400,
      '{"code":"refresh_token_already_used","message":"Invalid Refresh Token: Already Used"}',
    ],
    ["a validation error (current API shape)", 422, '{"code":"validation_failed","message":"Invalid grant"}'],
    ["a JSON 503 from the auth server, which auth-js retries itself", 503, '{"code":"unexpected_failure","message":"Unavailable"}'],
  ])("%s still reaches auth-js unchanged", async (_name, status, body) => {
    baseFetch.mockResolvedValue(
      new Response(body, {
        status,
        headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
      }),
    );
    const response = await supabaseFetch(TOKEN, { method: "POST" });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(JSON.parse(body));
  });
});

describe("a short deadline where cutting a request off is safe, a long one everywhere else", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function stall(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
    });
  }

  // Each of these is sent once and may already have taken effect on the server
  // (a session created, an email sent, a single-use captcha or code spent), so
  // it is never cut off at the short deadline. It still gets a long one: on
  // Android a stalled request otherwise never finishes, and her button spins
  // for good (re-review 2, R3).
  it.each([
    ["a password sign-in", `${PROJECT}/auth/v1/token?grant_type=password`, "POST"],
    ["a code exchange", `${PROJECT}/auth/v1/token?grant_type=pkce`, "POST"],
    ["a sign-up", `${PROJECT}/auth/v1/signup`, "POST"],
    ["a password reset email", `${PROJECT}/auth/v1/recover`, "POST"],
    ["a one-time code", `${PROJECT}/auth/v1/otp`, "POST"],
    ["an account update", `${PROJECT}/auth/v1/user`, "PUT"],
  ])("%s is not cut off at the short deadline, only at the long one", async (_name, url, method) => {
    baseFetch.mockImplementation(stall);
    let settled = false;
    void supabaseFetch(url, { method }).then(
      () => (settled = true),
      () => (settled = true),
    );

    await jest.advanceTimersByTimeAsync(AUTH_WRITE_TIMEOUT_MS - 100);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(200);
    expect(settled).toBe(true);
  });

  it("sign-out (POST /logout) is cut off at the short deadline, so auth-js signs her out on this phone", async () => {
    // Idempotent, no single-use input, and auth-js already treats a failed
    // /logout as "sign out locally" (GoTrueClient `_signOut`).
    baseFetch.mockImplementation(stall);
    const request = supabaseFetch(`${PROJECT}/auth/v1/logout?scope=local`, { method: "POST" });
    const outcome = expect(request).rejects.toThrow();

    await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    await outcome;
  });

  it("a read of her account (GET /user) is cut off, since it can simply be asked again", async () => {
    baseFetch.mockImplementation(stall);
    const request = supabaseFetch(`${PROJECT}/auth/v1/user`, { method: "GET" });
    const outcome = expect(request).rejects.toThrow();

    await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    await outcome;
  });
});

describe("refresh replies from the auth server that are not a revocation", () => {
  // GoTrue answers a refresh with 409 `conflict` when another refresh of the
  // same session still holds its row lock past GoTrue's own 5 s retry loop,
  // and with a `hook_*` code when a custom access-token hook times out or
  // misbehaves. Neither says her refresh token is bad, yet auth-js would delete
  // the session for both (re-review 2, R4). On the refresh only, they become a
  // network error, so the session is kept and retried.
  const REFRESH = TOKEN;
  const PASSWORD = `${PROJECT}/auth/v1/token?grant_type=password`;
  const goTrue = (body: string, status: number) =>
    new Response(body, {
      status,
      headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
    });

  it.each([
    ["409 conflict", 409, '{"code":"conflict","message":"Too many concurrent token refresh requests on the same session or refresh token"}'],
    ["409 in the older shape", 409, '{"code":409,"error_code":"conflict","msg":"Too many concurrent token refresh requests"}'],
    ["422 hook_timeout", 422, '{"code":"hook_timeout","message":"Failed to reach hook within maximum time of 5.000000 seconds"}'],
    ["422 hook_timeout_after_retry", 422, '{"code":"hook_timeout_after_retry","message":"Failed to reach hook after retry"}'],
    ["422 hook_payload_over_size_limit", 422, '{"code":"hook_payload_over_size_limit","message":"Payload size exceeded"}'],
  ])("a refresh answered with %s fails as a network error", async (_name, status, body) => {
    baseFetch.mockResolvedValue(goTrue(body, status));
    await expect(supabaseFetch(REFRESH, { method: "POST" })).rejects.toBeInstanceOf(TypeError);
  });

  it.each([
    ["refresh_token_not_found", '{"code":"refresh_token_not_found","message":"Invalid Refresh Token: Refresh Token Not Found"}'],
    ["refresh_token_already_used", '{"code":"refresh_token_already_used","message":"Invalid Refresh Token: Already Used"}'],
    ["session_not_found", '{"code":"session_not_found","message":"Invalid Refresh Token: No Valid Session Found"}'],
    ["session_expired", '{"code":"session_expired","message":"Invalid Refresh Token: Session Expired (Revoked by Newer Login)"}'],
    ["user_banned", '{"code":"user_banned","message":"Invalid Refresh Token: User Banned"}'],
  ])("a real revocation (%s) still reaches auth-js", async (_name, body) => {
    baseFetch.mockResolvedValue(goTrue(body, 400));
    const response = await supabaseFetch(REFRESH, { method: "POST" });
    expect(response.status).toBe(400);
  });

  it("the same 409 on a password sign-in is the auth server's answer, and passes through", async () => {
    baseFetch.mockResolvedValue(goTrue('{"code":"conflict","message":"Conflict"}', 409));
    const response = await supabaseFetch(PASSWORD, { method: "POST" });
    expect(response.status).toBe(409);
  });
});
