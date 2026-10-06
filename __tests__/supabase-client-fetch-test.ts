/**
 * The real `services/supabase/client.ts`, with SecureStore faked and the
 * network scripted, proving the auth fetch guard is actually wired in: the
 * client's own launch refresh, answered by a captive portal, keeps the stored
 * session instead of deleting it.
 *
 * The client refreshes on its own at construction (autoRefreshToken), so it is
 * required only after the expired session has been stored.
 */
const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockStore.delete(key)),
}));

jest.mock("../src/constants/env", () => ({
  env: {
    API_BASE_URL: "https://api.test",
    SUPABASE_URL: "https://project.supabase.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable",
    HCAPTCHA_SITEKEY: "sitekey",
  },
}));

import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseStorage } from "@/services/supabase/auth-storage";

// supabase-js derives the default key from the project host: sb-<ref>-auth-token.
const STORAGE_KEY = "sb-project-auth-token";
const PORTAL_PAGE = "<!doctype html><title>Sign in to the Wi-Fi</title>";

function expiredSession() {
  return {
    access_token: `old.${"x".repeat(1200)}`,
    refresh_token: "old-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) - 60,
    user: { id: "member", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
}

const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
let client: SupabaseClient | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(async () => {
  await client?.auth.dispose();
  jest.useRealTimers();
});

it("keeps the stored session when the launch refresh lands on a captive portal", async () => {
  await supabaseStorage.setItem(STORAGE_KEY, JSON.stringify(expiredSession()));
  fetchMock.mockImplementation(async () =>
    new Response(PORTAL_PAGE, { status: 511, headers: { "Content-Type": "text/html" } }),
  );

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the client must load after the session is stored
    client = (require("@/services/supabase/client") as { supabase: SupabaseClient }).supabase;
  });
  if (!client) throw new Error("client did not load");

  const pending = client.auth.getSession();
  await jest.advanceTimersByTimeAsync(60_000);
  const { data, error } = await pending;

  expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/auth/v1/token"))).toBe(true);
  expect(data.session).toBeNull();
  expect(isAuthRetryableFetchError(error)).toBe(true);
  const stored = await supabaseStorage.getItem(STORAGE_KEY);
  expect(stored && (JSON.parse(stored) as { refresh_token: string }).refresh_token).toBe("old-refresh");
});
