/**
 * Launch-time session restore in `use-auth-listener`.
 *
 * Opening the app after the access token has expired makes auth-js refresh it
 * before it can answer `getSession()`. On a dropped connection that refresh
 * fails with a retryable error, auth-js keeps the session on the device, and
 * reports `session: null` (installed @supabase/auth-js 2.112.2,
 * `GoTrueClient.__loadSession` + `_callRefreshToken`). The listener used to
 * read that null as "signed out", so a signed-in member was sent to the login
 * screen by a lift or a tunnel. It now waits and retries; only a definite
 * answer resolves the launch gate.
 *
 * The retryable errors here are the installed library's own classes, so this
 * test breaks if a supabase-js upgrade changes how they are recognised.
 */
jest.mock("../src/services/supabase/client", () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
}));

jest.mock("../src/constants/env", () => ({
  env: {
    API_BASE_URL: "https://api.test",
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable",
    HCAPTCHA_SITEKEY: "sitekey",
  },
}));

import {
  AuthApiError,
  AuthRefreshDiscardedError,
  AuthRetryableFetchError,
  type AuthChangeEvent,
  type Session,
} from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useAuthListener } from "@/features/auth/hooks/use-auth-listener";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useOnboardingStore } from "@/stores/onboarding-store";

const getSession = supabase.auth.getSession as unknown as jest.Mock;
const onAuthStateChange = supabase.auth.onAuthStateChange as unknown as jest.Mock;

const session = { access_token: "access", refresh_token: "refresh", user: { id: "member" } } as Session;
const signedIn = { data: { session }, error: null };
const signedOut = { data: { session: null }, error: null };
const offline = () => ({
  data: { session: null },
  error: new AuthRetryableFetchError("Network request failed", 0),
});

let emit: (event: AuthChangeEvent, session: Session | null) => void = () => undefined;
let appStateListener: ((state: AppStateStatus) => void) | null = null;
const unsubscribe = jest.fn();
const removeAppStateListener = jest.fn();
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

async function mount() {
  const view = await renderHook(() => useAuthListener(), { wrapper });
  // Let the first restore attempt settle.
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  queryClient = new QueryClient();
  getSession.mockReset();
  onAuthStateChange.mockReset();
  unsubscribe.mockReset();
  removeAppStateListener.mockReset();
  onAuthStateChange.mockImplementation((callback: typeof emit) => {
    emit = callback;
    return { data: { subscription: { unsubscribe } } };
  });
  appStateListener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: removeAppStateListener };
  });
  useAuthStore.setState({ session: null, loading: true, recovery: false });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("a launch that cannot reach Supabase", () => {
  it("keeps the gate closed instead of routing a signed-in member to login", async () => {
    getSession.mockResolvedValueOnce(offline()).mockResolvedValueOnce(signedIn);

    await mount();
    // auth-js reports the same failed read to subscribers as INITIAL_SESSION.
    await act(async () => emit("INITIAL_SESSION", null));

    expect(useAuthStore.getState()).toMatchObject({ loading: true, session: null });

    await advance(1_000);

    expect(useAuthStore.getState()).toMatchObject({ loading: false, session });
  });

  it("keeps retrying through a long outage without hammering", async () => {
    getSession.mockImplementation(async () => offline());

    await mount();
    await advance(10 * 60_000);

    expect(useAuthStore.getState().loading).toBe(true);
    const attempts = getSession.mock.calls.length;
    expect(attempts).toBeGreaterThan(10);
    // Backoff capped at 30 s: at most ~25 attempts in ten minutes.
    expect(attempts).toBeLessThan(30);
  });

  it("retries at once when she brings the app back to the foreground", async () => {
    getSession.mockResolvedValueOnce(offline()).mockResolvedValueOnce(signedIn);

    await mount();
    expect(appStateListener).not.toBeNull();
    await act(async () => {
      appStateListener?.("active");
      await Promise.resolve();
    });

    expect(useAuthStore.getState()).toMatchObject({ loading: false, session });
  });

  it("settles on the session a background refresh delivers, and stops retrying", async () => {
    getSession.mockImplementation(async () => offline());

    await mount();
    await act(async () => emit("TOKEN_REFRESHED", session));
    const attempts = getSession.mock.calls.length;
    await advance(5 * 60_000);

    expect(useAuthStore.getState()).toMatchObject({ loading: false, session });
    expect(getSession).toHaveBeenCalledTimes(attempts);
  });

  it("retries a refresh the library discarded because storage changed under it", async () => {
    getSession
      .mockResolvedValueOnce({ data: { session: null }, error: new AuthRefreshDiscardedError() })
      .mockResolvedValueOnce(signedIn);

    await mount();
    expect(useAuthStore.getState().loading).toBe(true);
    await advance(1_000);

    expect(useAuthStore.getState()).toMatchObject({ loading: false, session });
  });

  it("retries when reading secure storage throws, rather than hanging the splash", async () => {
    getSession.mockRejectedValueOnce(new Error("keystore unavailable")).mockResolvedValueOnce(signedIn);

    await mount();
    expect(useAuthStore.getState().loading).toBe(true);
    await advance(1_000);

    expect(useAuthStore.getState()).toMatchObject({ loading: false, session });
  });
});

describe("a definite answer still resolves straight away", () => {
  it("a stored session opens the app", async () => {
    getSession.mockResolvedValue(signedIn);

    await mount();

    expect(useAuthStore.getState()).toMatchObject({ loading: false, session });
  });

  it("no stored session goes to login, with no retry", async () => {
    getSession.mockResolvedValue(signedOut);

    await mount();
    await advance(60_000);

    expect(useAuthStore.getState()).toMatchObject({ loading: false, session: null });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("a refresh token the server rejected goes to login, with no retry", async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"),
    });

    await mount();
    await advance(60_000);

    expect(useAuthStore.getState()).toMatchObject({ loading: false, session: null });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("a sign-out during the retry window goes to login", async () => {
    getSession.mockImplementation(async () => offline());

    await mount();
    await act(async () => emit("SIGNED_OUT", null));

    expect(useAuthStore.getState()).toMatchObject({ loading: false, session: null });
  });
});

describe("after launch", () => {
  it("sign-out still clears the cache and her onboarding draft", async () => {
    getSession.mockResolvedValue(signedIn);
    const clear = jest.spyOn(queryClient, "clear");
    useOnboardingStore.setState({ active: true });

    await mount();
    await act(async () => emit("SIGNED_OUT", null));

    expect(useAuthStore.getState().session).toBeNull();
    expect(clear).toHaveBeenCalled();
    expect(useOnboardingStore.getState().active).toBe(false);
  });

  it("follows later session changes", async () => {
    getSession.mockResolvedValue(signedOut);
    await mount();

    await act(async () => emit("SIGNED_IN", session));

    expect(useAuthStore.getState().session).toBe(session);
  });

  it("stops every timer and listener on unmount", async () => {
    getSession.mockImplementation(async () => offline());
    const view = await mount();

    view.unmount();
    await advance(5 * 60_000);

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalled();
    expect(removeAppStateListener).toHaveBeenCalled();
  });
});
