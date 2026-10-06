/**
 * The launch gate's holding view, for ANY time the launch is not ready.
 *
 * Re-review N2: with a valid stored token, `getSession()` answers from disk at
 * once and the gate then waits on her profile. On a stalled connection that
 * request never answered, `ready` never turned true, and because the holding
 * view was armed only while the session restore was pending, the native
 * splash stayed up for good. This runs the real listener, the real
 * `useAppDestination` and the real profile query (only `fetchProfile`
 * scripted), as the reviewer's probe did, and holds the fixed behaviour.
 */
jest.mock("../src/services/supabase/client", () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
}));
jest.mock("../src/services/supabase/profile", () => ({
  fetchProfile: jest.fn(),
  updateStyleProfile: jest.fn(),
}));
jest.mock("../src/constants/env", () => ({
  env: {
    API_BASE_URL: "https://api.test",
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable",
    HCAPTCHA_SITEKEY: "sitekey",
  },
}));

import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook } from "@testing-library/react-native";

import { useAppDestination } from "@/features/auth/hooks/use-app-destination";
import { useAuthListener } from "@/features/auth/hooks/use-auth-listener";
import { useLaunchHold } from "@/features/auth/hooks/use-launch-hold";
import { supabase } from "@/services/supabase/client";
import { fetchProfile } from "@/services/supabase/profile";
import { useAuthStore } from "@/stores/auth-store";

const getSession = supabase.auth.getSession as unknown as jest.Mock;
const onAuthStateChange = supabase.auth.onAuthStateChange as unknown as jest.Mock;
const mockFetchProfile = fetchProfile as unknown as jest.Mock;

const session = { access_token: "access", refresh_token: "refresh", user: { id: "member" } } as Session;
const completeProfile = {
  body_type: "Hourglass",
  color_season: "Autumn True",
  color_season_base: "Autumn",
  skin_undertone: "Warm",
  face_shape: "Oval",
  hair_type: "Wavy",
  gender: "Female",
  hair_length: "Long",
  skin_depth: "Medium",
  color_profile: { season: "Autumn" },
  suspended: false,
};

type Gate = ReturnType<typeof useAppDestination> & { hold: ReturnType<typeof useLaunchHold> };
/** Every value the gate yields, in order (pushed, not reassigned, for the compiler). */
const frames: Gate[] = [];
const latestFrame = (): Gate | undefined => frames[frames.length - 1];

function Probe() {
  useAuthListener();
  const destination = useAppDestination();
  const hold = useLaunchHold(!destination.ready);
  frames.push({ ...destination, hold });
  return null;
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  frames.length = 0;
  getSession.mockReset().mockResolvedValue({ data: { session }, error: null });
  onAuthStateChange
    .mockReset()
    .mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
  mockFetchProfile.mockReset();
  useAuthStore.setState({
    session: null,
    loading: true,
    recovery: false,
    launchStalled: false,
    launchAttempting: false,
    launchRetryRequests: 0,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  );
  await advance(10);
}

it("a valid token with a profile request that never answers shows the holding view, not a frozen splash", async () => {
  mockFetchProfile.mockImplementation(() => new Promise(() => undefined));

  await mount();
  expect(useAuthStore.getState()).toMatchObject({ loading: false, session });
  expect(latestFrame()?.hold.stalled).toBe(false);

  await advance(5_000);
  expect(latestFrame()?.ready).toBe(false);
  expect(latestFrame()?.hold).toMatchObject({ stalled: true, stage: "profile" });

  // The reviewer's probe ran ten minutes: the view is still there to act on.
  await advance(10 * 60_000);
  expect(latestFrame()?.hold).toMatchObject({ stalled: true, stage: "profile" });
});

it("in the profile stage, Try again asks for her profile again, and the app opens when it lands", async () => {
  mockFetchProfile.mockImplementationOnce(() => new Promise(() => undefined));
  await mount();
  await advance(5_000);
  expect(latestFrame()?.hold.stage).toBe("profile");

  mockFetchProfile.mockResolvedValue(completeProfile);
  await act(async () => {
    latestFrame()?.hold.retryProfile();
  });
  await advance(10);

  expect(mockFetchProfile).toHaveBeenCalledTimes(2);
  expect(latestFrame()).toMatchObject({ ready: true, destination: "/" });
  expect(latestFrame()?.hold.stalled).toBe(false);
  expect(useAuthStore.getState().launchStalled).toBe(false);
});

it("stays on the holding view from the session stage straight into the profile stage, with no gap", async () => {
  let answer: (value: unknown) => void = () => undefined;
  getSession.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
  mockFetchProfile.mockImplementation(() => new Promise(() => undefined));

  await mount();
  await advance(5_000);
  expect(latestFrame()?.hold).toMatchObject({ stalled: true, stage: "session" });

  await act(async () => {
    answer({ data: { session }, error: null });
  });
  await advance(10);

  expect(latestFrame()?.hold).toMatchObject({ stalled: true, stage: "profile" });
});

it("never shows the holding view when the launch is ready in time", async () => {
  mockFetchProfile.mockResolvedValue(completeProfile);

  await mount();
  await advance(60_000);

  expect(latestFrame()).toMatchObject({ ready: true, destination: "/" });
  expect(latestFrame()?.hold.stalled).toBe(false);
  expect(useAuthStore.getState().launchStalled).toBe(false);
});

it("a first profile read that fails after its retries keeps her on the holding view, never onboarding", async () => {
  mockFetchProfile.mockRejectedValue(new Error("AbortError: Aborted"));

  await mount();
  await advance(5_000);

  expect(latestFrame()?.ready).toBe(false);
  expect(latestFrame()?.hold).toMatchObject({ stalled: true, stage: "profile" });
  expect(frames.some((f) => f.ready && f.destination === "/onboarding/welcome")).toBe(false);

  // Try again, and this time the read lands: home, not onboarding.
  mockFetchProfile.mockResolvedValue(completeProfile);
  await act(async () => {
    latestFrame()?.hold.retryProfile();
  });
  await advance(10);

  expect(latestFrame()).toMatchObject({ ready: true, destination: "/" });
  expect(frames.some((f) => f.ready && f.destination === "/onboarding/welcome")).toBe(false);
});

it("a hold that unmounts while stalled clears the flag, so the next hold waits its own 5 s", async () => {
  // Two screens arm the hold: the root layout and the auth callback screen.
  // One leaving while stalled must not leave the next one stalled at once.
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const first = await renderHook(() => useLaunchHold(true), { wrapper });
  await advance(5_000);
  expect(useAuthStore.getState().launchStalled).toBe(true);

  await first.unmount();
  expect(useAuthStore.getState().launchStalled).toBe(false);

  const second = await renderHook(() => useLaunchHold(true), { wrapper });
  expect(second.result.current.stalled).toBe(false);
  await advance(5_000);
  expect(second.result.current.stalled).toBe(true);
});
