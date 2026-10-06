/**
 * The installed auth client (@supabase/supabase-js 2.112.2, re-exporting
 * @supabase/auth-js 2.112.2) driving the real session adapter, with
 * SecureStore faked and the network scripted.
 *
 * Three things the app relies on are pinned against the library itself, so an
 * upgrade that changes one fails here rather than on a member's phone:
 *
 * 1. Concurrent reads of an expired session share ONE refresh request and
 *    store one whole session, with no `lock` option. That is why `client.ts`
 *    does not pass the deprecated `lock: processLock` (see the note there).
 * 2. A refresh that fails on a dropped connection keeps the session on the
 *    device and reports a retryable error: what `use-auth-listener` retries on.
 * 3. `signOut({ scope: "local" })` revokes only this session on the server and
 *    clears it from the device.
 * 4. With the app's fetch guard (`auth-fetch.ts`), a refresh answered by a
 *    captive portal, a proxy or a rate limit keeps the session, while a refresh
 *    token the auth server revoked still signs her out.
 */
const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockStore.delete(key)),
}));

import {
  AuthClient,
  isAuthRefreshDiscardedError,
  isAuthRetryableFetchError,
  type AuthChangeEvent,
} from "@supabase/supabase-js";

import { AUTH_REQUEST_TIMEOUT_MS, createSupabaseFetch } from "@/services/supabase/auth-fetch";
import { supabaseStorage } from "@/services/supabase/auth-storage";

const AUTH_URL = "https://project.supabase.test/auth/v1";
const STORAGE_KEY = "sb-project-auth-token";

/** Sized like a real session, so the adapter has to chunk it. */
function makeSession(tag: string, expiresAt: number) {
  return {
    access_token: `${tag}.${"x".repeat(1200)}`,
    refresh_token: `${tag}-refresh`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: "member",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { username: "member", bio: "y".repeat(600) },
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();
const refreshCalls = () =>
  fetchMock.mock.calls.filter(([url]) => url.includes("/token?grant_type=refresh_token")).length;

function makeClient(clientFetch: typeof fetch = fetchMock as unknown as typeof fetch) {
  return new AuthClient({
    url: AUTH_URL,
    storageKey: STORAGE_KEY,
    storage: supabaseStorage,
    persistSession: true,
    // Off so construction does not refresh on its own; getSession() still
    // refreshes an expired session, which is the path under test.
    autoRefreshToken: false,
    detectSessionInUrl: false,
    fetch: clientFetch,
  });
}

/** The client as `client.ts` configures it: every request through the guard. */
function makeGuardedClient() {
  const guarded = createSupabaseFetch("https://project.supabase.test", {
    baseFetch: fetchMock as unknown as typeof fetch,
  });
  return makeClient(guarded as typeof fetch);
}

async function storedSession(): Promise<{ refresh_token: string } | null> {
  const raw = await supabaseStorage.getItem(STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as { refresh_token: string });
}

// `AuthClient` is exported as a value (`typeof GoTrueClient`), not a type.
let client: InstanceType<typeof AuthClient> | null = null;

beforeEach(async () => {
  mockStore.clear();
  fetchMock.mockReset();
  await supabaseStorage.setItem(STORAGE_KEY, JSON.stringify(makeSession("old", nowSeconds() - 60)));
});

afterEach(() => {
  client?.dispose();
  client = null;
  jest.useRealTimers();
});

it("shares one refresh between concurrent reads and stores one whole session, with no lock", async () => {
  fetchMock.mockImplementation(async (url) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (url.includes("/token?grant_type=refresh_token")) {
      return jsonResponse(makeSession("new", nowSeconds() + 3600));
    }
    return jsonResponse({}, 404);
  });
  client = makeClient();

  const results = await Promise.all([client.getSession(), client.getSession(), client.getSession()]);

  expect(refreshCalls()).toBe(1);
  for (const { data, error } of results) {
    expect(error).toBeNull();
    expect(data.session?.refresh_token).toBe("new-refresh");
  }
  expect((await storedSession())?.refresh_token).toBe("new-refresh");
});

it("keeps the session on the device and reports a retryable error when the network is down", async () => {
  jest.useFakeTimers();
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  client = makeClient();

  // auth-js retries a failed refresh with backoff for up to ~30 s on its own.
  const pending = client.getSession();
  await jest.advanceTimersByTimeAsync(35_000);
  const { data, error } = await pending;

  expect(data.session).toBeNull();
  expect(isAuthRetryableFetchError(error)).toBe(true);
  expect((await storedSession())?.refresh_token).toBe("old-refresh");

  // Connection back. The library holds a failed refresh token in a 60 s
  // cooldown, so the next read after it refreshes for real.
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(makeSession("new", nowSeconds() + 3600)));
  await jest.advanceTimersByTimeAsync(61_000);
  const retried = client.getSession();
  await jest.advanceTimersByTimeAsync(1_000);

  expect((await retried).data.session?.refresh_token).toBe("new-refresh");
  expect((await storedSession())?.refresh_token).toBe("new-refresh");
});

it("signs out this session only and clears it from the device", async () => {
  await supabaseStorage.setItem(STORAGE_KEY, JSON.stringify(makeSession("live", nowSeconds() + 3600)));
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  client = makeClient();

  const { error } = await client.signOut({ scope: "local" });

  expect(error).toBeNull();
  const logout = fetchMock.mock.calls.find(([url]) => url.includes("/logout"));
  expect(logout?.[0]).toBe(`${AUTH_URL}/logout?scope=local`);
  expect(await supabaseStorage.getItem(STORAGE_KEY)).toBeNull();
  expect(mockStore.size).toBe(0);
});

describe("a launch refresh answered by something other than the auth server", () => {
  const PORTAL_PAGE = "<!doctype html><title>Sign in to the Wi-Fi</title>";

  function reply(body: string | null, status: number, contentType: string) {
    return () => Promise.resolve(new Response(body, { status, headers: { "Content-Type": contentType } }));
  }

  /**
   * Runs one launch-time read of an expired session against a scripted
   * `/token` reply. auth-js retries a retryable failure with backoff for up to
   * ~30 s on its own, so the clock is advanced past that.
   */
  async function launchWith(
    answer: (url: string, init?: RequestInit) => Promise<Response>,
    guarded = true,
  ) {
    jest.useFakeTimers();
    fetchMock.mockImplementation(answer);
    client = guarded ? makeGuardedClient() : makeClient();
    const events: AuthChangeEvent[] = [];
    client.onAuthStateChange((event) => {
      events.push(event);
    });

    const pending = client.getSession();
    await jest.advanceTimersByTimeAsync(2 * AUTH_REQUEST_TIMEOUT_MS + 10_000);
    const result = await pending;
    return { ...result, events, stored: await storedSession() };
  }

  it.each([
    ["a captive portal page with 511", reply(PORTAL_PAGE, 511, "text/html")],
    ["a captive portal page with 403", reply(PORTAL_PAGE, 403, "text/html")],
    ["a captive portal page with 200", reply(PORTAL_PAGE, 200, "text/html")],
    ["a proxy asking for credentials (407)", reply(PORTAL_PAGE, 407, "text/html")],
    [
      "a rate limit (429)",
      reply('{"code":429,"error_code":"over_request_rate_limit","msg":"Too many requests"}', 429, "application/json"),
    ],
  ])("%s keeps her session on the device and reports a retryable error", async (_name, answer) => {
    const { data, error, events, stored } = await launchWith(answer);

    expect(data.session).toBeNull();
    expect(isAuthRetryableFetchError(error)).toBe(true);
    expect(stored?.refresh_token).toBe("old-refresh");
    expect(events).not.toContain("SIGNED_OUT");
  });

  it("a refresh that stalls is cut off and retried, and keeps the session", async () => {
    // Answers nothing until the request's signal aborts it.
    const stall = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
      });

    const { error, stored } = await launchWith(stall);

    expect(isAuthRetryableFetchError(error)).toBe(true);
    expect(stored?.refresh_token).toBe("old-refresh");
  });

  it.each([
    ["a revoked refresh token", '{"code":400,"error_code":"refresh_token_not_found","msg":"Invalid Refresh Token: Refresh Token Not Found"}'],
    ["a legacy invalid_grant error", '{"error":"invalid_grant","error_description":"Invalid Refresh Token"}'],
  ])("%s from the auth server still signs her out, with no retry", async (_name, body) => {
    const { data, error, events, stored } = await launchWith(reply(body, 400, "application/json"));

    expect(data.session).toBeNull();
    expect(error).not.toBeNull();
    expect(isAuthRetryableFetchError(error)).toBe(false);
    expect(isAuthRefreshDiscardedError(error)).toBe(false);
    expect(stored).toBeNull();
    expect(events).toContain("SIGNED_OUT");
  });

  it("without the guard, auth-js deletes the session on a portal page (why the guard exists)", async () => {
    const { stored, events } = await launchWith(reply(PORTAL_PAGE, 511, "text/html"), false);

    expect(stored).toBeNull();
    expect(events).toContain("SIGNED_OUT");
  });

  /** A reply carrying the API version header GoTrue sends on every response. */
  function goTrueReply(body: string, status: number) {
    return () =>
      Promise.resolve(
        new Response(body, {
          status,
          headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
        }),
      );
  }

  it.each([
    ["a 200 that is not a session", reply('{"status":"login_required"}', 200, "application/json")],
    ["a 200 with JSON null", reply("null", 200, "application/json")],
    [
      "the gateway's 401 Invalid API key",
      reply('{"message":"Invalid API key","hint":"Double check your Supabase `anon` or `service_role` API key."}', 401, "application/json"),
    ],
    ["a firewall's JSON 403", reply('{"error":"Forbidden"}', 403, "application/json")],
  ])("JSON that is not from the auth server (%s) keeps her session", async (_name, answer) => {
    const { data, error, events, stored } = await launchWith(answer);

    expect(data.session).toBeNull();
    expect(isAuthRetryableFetchError(error)).toBe(true);
    expect(stored?.refresh_token).toBe("old-refresh");
    expect(events).not.toContain("SIGNED_OUT");
  });

  it.each([
    [
      "a revoked session (session_not_found)",
      goTrueReply('{"code":"session_not_found","message":"Session from session_id claim in JWT does not exist"}', 403),
    ],
    [
      "a reused refresh token (refresh_token_already_used)",
      goTrueReply('{"code":"refresh_token_already_used","message":"Invalid Refresh Token: Already Used"}', 400),
    ],
  ])("%s in the auth server's current shape still signs her out", async (_name, answer) => {
    const { data, error, events, stored } = await launchWith(answer);

    expect(data.session).toBeNull();
    expect(isAuthRetryableFetchError(error)).toBe(false);
    expect(stored).toBeNull();
    expect(events).toContain("SIGNED_OUT");
  });
});
