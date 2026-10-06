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
 */
const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockStore.delete(key)),
}));

import { AuthClient, isAuthRetryableFetchError } from "@supabase/supabase-js";

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

function makeClient() {
  return new AuthClient({
    url: AUTH_URL,
    storageKey: STORAGE_KEY,
    storage: supabaseStorage,
    persistSession: true,
    // Off so construction does not refresh on its own; getSession() still
    // refreshes an expired session, which is the path under test.
    autoRefreshToken: false,
    detectSessionInUrl: false,
    fetch: fetchMock as unknown as typeof fetch,
  });
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
