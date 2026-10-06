/**
 * Sign out is the one action that must never fail quietly: a swallowed error
 * leaves the member signed in on a device she believes she has left.
 *
 * Same mocking shape as `api-client-test` — `jest.fn()`s inside the factory,
 * relative paths, and `env` stubbed because `auth.ts` reaches the api client at
 * import time.
 */
jest.mock("../src/services/supabase/client", () => ({
  supabase: { auth: { getSession: jest.fn(), refreshSession: jest.fn(), signOut: jest.fn() } },
}));

jest.mock("../src/constants/env", () => ({
  env: {
    API_BASE_URL: "https://api.test",
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable",
    HCAPTCHA_SITEKEY: "sitekey",
  },
}));

import { signOut } from "@/services/api/auth";
import { ApiError } from "@/services/api/client";
import { supabase } from "@/services/supabase/client";

const mockSignOut = supabase.auth.signOut as unknown as jest.Mock;

beforeEach(() => mockSignOut.mockReset());

test("resolves when Supabase clears the session", async () => {
  mockSignOut.mockResolvedValue({ error: null });
  await expect(signOut()).resolves.toBeUndefined();
});

test("signs out this device only, never her other phones or the website", async () => {
  // auth-js defaults signOut() to scope "global", which revokes every session
  // the member has. Signing out of one phone must not sign her out elsewhere.
  mockSignOut.mockResolvedValue({ error: null });
  await signOut();
  expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
});

test("throws when Supabase reports an error, so the button cannot lie", async () => {
  mockSignOut.mockResolvedValue({ error: { message: "network request failed" } });
  await expect(signOut()).rejects.toBeInstanceOf(ApiError);
});
