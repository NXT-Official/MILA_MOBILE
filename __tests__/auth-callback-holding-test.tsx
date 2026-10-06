/**
 * The email-link / OAuth callback screen when the launch is not ready.
 *
 * Once the link is verified the screen waits for the launch gate (her
 * profile) before redirecting. The root layout does not arm its holding view
 * on this route, so a profile read that stalled or failed left her on "Opening
 * your studio" for good. Since a failed read no longer routes to onboarding
 * (owner ruling, 2026-10-07), that wait would never end on a dead connection.
 *
 * This drives the real `useAppDestination`, the real profile query (only
 * `fetchProfile` scripted), the real `useLaunchHold` and the real holding
 * view: after 5 s she gets the same view as the launch screen, Try again
 * only (she has a session), and a later successful read lands her home.
 */
jest.mock("expo-linking", () => ({ useLinkingURL: jest.fn() }));
jest.mock("expo-router", () => ({
  Redirect: jest.fn(() => null),
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));
jest.mock("../src/services/api/auth", () => ({ completeAuthCallback: jest.fn() }));
jest.mock("../src/services/supabase/profile", () => ({
  fetchProfile: jest.fn(),
  updateStyleProfile: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { Redirect } from "expo-router";

import { AuthCallbackScreen } from "@/features/auth/AuthCallbackScreen";
import { completeAuthCallback } from "@/services/api/auth";
import { fetchProfile } from "@/services/supabase/profile";
import { useAuthStore } from "@/stores/auth-store";

const callback = "mila://auth/callback#access_token=test-access&refresh_token=test-refresh";
const session = { access_token: "access", refresh_token: "refresh", user: { id: "member" } } as Session;
const mockFetchProfile = fetchProfile as unknown as jest.Mock;
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

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <AuthCallbackScreen />
    </QueryClientProvider>,
  );
  await advance(10);
}

const redirectedTo = () =>
  jest.mocked(Redirect).mock.calls.map(([props]) => (props as { href: string }).href);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(Linking.useLinkingURL).mockReturnValue(callback);
  // The link verifies, and auth-js has stored her session (SIGNED_IN).
  jest
    .mocked(completeAuthCallback)
    .mockResolvedValue(session as Awaited<ReturnType<typeof completeAuthCallback>>);
  mockFetchProfile.mockReset();
  useAuthStore.setState({
    session,
    loading: false,
    recovery: false,
    launchStalled: false,
    launchAttempting: false,
    launchRetryRequests: 0,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

it("a stuck callback shows the launch holding view at 5 s, with Try again only", async () => {
  mockFetchProfile.mockImplementation(() => new Promise(() => undefined));

  await mount();
  expect(screen.getByText("Opening your studio")).toBeTruthy();
  expect(screen.queryByText("Still trying to reach Mila")).toBeNull();

  await advance(5_000);

  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  // She is signed in: there is nothing to sign in to again.
  expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();
  expect(Redirect).not.toHaveBeenCalled();
});

it("after a failed profile read, Try again lands her home, never in onboarding", async () => {
  mockFetchProfile.mockRejectedValue(new Error("AbortError: Aborted"));

  await mount();
  await advance(5_000);
  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
  expect(redirectedTo()).not.toContain("/onboarding/welcome");

  mockFetchProfile.mockResolvedValue(completeProfile);
  await act(async () => {
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  });
  await advance(10);

  expect(redirectedTo()).toContain("/");
  expect(redirectedTo()).not.toContain("/onboarding/welcome");
});

it("a callback whose launch is ready in time goes straight home, with no holding view", async () => {
  mockFetchProfile.mockResolvedValue(completeProfile);

  await mount();
  await advance(10_000);

  expect(redirectedTo()).toContain("/");
  expect(screen.queryByText("Still trying to reach Mila")).toBeNull();
});
