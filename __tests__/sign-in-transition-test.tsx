/**
 * What the launch gate reports between "she signed in" and Home.
 *
 * On the web a member briefly saw the landing page after logging in. This
 * pins the mobile equivalent: the real auth listener, the real profile query
 * (TanStack Query, with only the network call scripted) and the real gate,
 * recording every value the gate yields. The root layout renders its neutral
 * holding view while `ready` is false (the native splash on a cold start), so
 * the property is: no frame is ever `ready` with a destination other than the
 * one she ends up at. A `ready` frame on `/login` or `/onboarding/welcome` on
 * the way to `/` would be a wrong screen painted for a moment.
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

import { AuthRetryableFetchError, type AuthChangeEvent, type Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react-native";

import { useAppDestination, type Destination } from "@/features/auth/hooks/use-app-destination";
import { useAuthListener } from "@/features/auth/hooks/use-auth-listener";
import { supabase } from "@/services/supabase/client";
import { fetchProfile } from "@/services/supabase/profile";
import { useAuthStore } from "@/stores/auth-store";
import { useOnboardingStore } from "@/stores/onboarding-store";

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

type Frame = { ready: boolean; destination: Destination };
let frames: Frame[] = [];
let emit: (event: AuthChangeEvent, session: Session | null) => void = () => undefined;

function Probe() {
  useAuthListener();
  frames.push(useAppDestination());
  return null;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** TanStack Query notifies observers on a `setTimeout(0)`; let those run too. */
async function flush() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10);
  });
}

/** Every ready frame from `from` on must show `expected`. */
function readyDestinations(from: number): Destination[] {
  return frames.slice(from).filter((f) => f.ready).map((f) => f.destination);
}

beforeEach(() => {
  jest.useFakeTimers();
  frames = [];
  getSession.mockReset();
  mockFetchProfile.mockReset();
  onAuthStateChange.mockReset().mockImplementation((callback: typeof emit) => {
    emit = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  useAuthStore.setState({ session: null, loading: true, recovery: false });
  useOnboardingStore.setState({ active: false });
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
  await flush();
}

it("holds a neutral state from password sign-in until Home is known, with no login or onboarding frame", async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  await mount();
  expect(frames[frames.length - 1]).toEqual({ ready: true, destination: "/login" });

  const profile = deferred<typeof completeProfile>();
  mockFetchProfile.mockReturnValue(profile.promise);
  const signedInAt = frames.length;

  // auth-js fires SIGNED_IN from inside signInWithPassword.
  await act(async () => emit("SIGNED_IN", session));
  await flush();

  expect(frames.length).toBeGreaterThan(signedInAt);
  expect(readyDestinations(signedInAt)).toEqual([]);

  await act(async () => profile.resolve(completeProfile));
  await flush();

  expect(frames[frames.length - 1]).toEqual({ ready: true, destination: "/" });
  expect(new Set(readyDestinations(signedInAt))).toEqual(new Set(["/"]));
});

it("sends a member with an unfinished dossier to onboarding, also without a wrong frame first", async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  await mount();

  mockFetchProfile.mockResolvedValue({ ...completeProfile, body_type: null });
  const signedInAt = frames.length;
  await act(async () => emit("SIGNED_IN", session));
  await flush();

  expect(new Set(readyDestinations(signedInAt))).toEqual(new Set(["/onboarding/welcome"]));
});

it("never shows login on a cold start whose session refresh hit a dropped connection", async () => {
  mockFetchProfile.mockResolvedValue(completeProfile);
  getSession
    .mockResolvedValueOnce({
      data: { session: null },
      error: new AuthRetryableFetchError("Network request failed", 0),
    })
    .mockResolvedValueOnce({ data: { session }, error: null });

  await mount();
  await act(async () => emit("INITIAL_SESSION", null));
  expect(readyDestinations(0)).toEqual([]);

  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_000);
  });
  await flush();

  expect(frames[frames.length - 1]).toEqual({ ready: true, destination: "/" });
  expect(new Set(readyDestinations(0))).toEqual(new Set(["/"]));
});
