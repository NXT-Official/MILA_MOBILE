/**
 * The profile-stage "Try again" on the REAL launch gate (re-review 2, R2).
 *
 * The holding view appears once her profile read has stalled for 5 s. The
 * button used to show busy for as long as ANY profile read was out, and a
 * stalled read is a read that is out, so it could not be pressed between 5 s
 * and the read's last retry (~48 s): the one action on the screen did nothing
 * when it was needed. Earlier tests called the handler directly or mocked the
 * gate, so they could not see it. This one mounts the real root layout with
 * the real listener, `useAppDestination`, `useLaunchHold`, profile query and
 * holding view, scripts only the session and the profile request, and presses
 * the button on screen.
 */
jest.mock("@/theme/global.css", () => ({}));
jest.mock("@expo-google-fonts/inter/400Regular", () => ({ Inter_400Regular: 1 }));
jest.mock("@expo-google-fonts/inter/500Medium", () => ({ Inter_500Medium: 1 }));
jest.mock("@expo-google-fonts/inter/600SemiBold", () => ({ Inter_600SemiBold: 1 }));
jest.mock("@expo-google-fonts/playfair-display/700Bold", () => ({ PlayfairDisplay_700Bold: 1 }));
jest.mock("@expo-google-fonts/playfair-display/800ExtraBold", () => ({
  PlayfairDisplay_800ExtraBold: 1,
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModalProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock("@sentry/react-native", () => ({
  wrap: (component: unknown) => component,
  captureException: jest.fn(),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  function Stack({ children }: { children: unknown }) {
    return children;
  }
  function Protected({ guard, children }: { guard: boolean; children: unknown }) {
    return guard ? children : null;
  }
  function Screen({ name }: { name: string }) {
    return React.createElement(Text, null, `screen:${name}`);
  }
  Stack.Protected = Protected;
  Stack.Screen = Screen;
  return { Stack, usePathname: () => "/" };
});
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({ children }: { children: unknown }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaInsetsContext: { Provider: ({ children }: { children: unknown }) => children },
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/components/layout/AppHeader", () => ({ AppHeader: () => null }));
jest.mock("@/features/lens/components/LensSheet", () => ({ LensSheet: () => null }));
jest.mock("@/services/crash-reporting", () => ({}));
jest.mock("@/stores/lens-store", () => ({
  useLensStore: (select: (state: { open: boolean; setOpen: () => void }) => unknown) =>
    select({ open: false, setOpen: () => undefined }),
}));
jest.mock("@/stores/theme-store", () => ({
  useThemeStore: (select: (state: { hydrated: boolean }) => unknown) => select({ hydrated: true }),
}));
jest.mock("@/theme/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock("@/constants/env", () => ({
  env: {
    API_BASE_URL: "https://api.test",
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable",
    HCAPTCHA_SITEKEY: "sitekey",
  },
}));
jest.mock("@/services/supabase/client", () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } },
}));

/** Every profile request the gate makes; each answers only when told, or aborts. */
type MockProfileCall = {
  signal: AbortSignal | undefined;
  resolve: (row: unknown) => void;
};
const mockProfileCalls: MockProfileCall[] = [];
/** When set, later reads fail at once, as fetchProfile's own deadline makes a stalled one. */
const mockReads = { failFast: false };
jest.mock("@/services/supabase/profile", () => ({
  updateStyleProfile: jest.fn(),
  fetchProfile: jest.fn(
    (_userId: string, signal?: AbortSignal) =>
      new Promise((resolve, reject) => {
        mockProfileCalls.push({ signal, resolve });
        if (mockReads.failFast) reject(new Error("AbortError: Aborted"));
        signal?.addEventListener("abort", () => reject(new Error("AbortError: Aborted")));
      }),
  ),
}));

import type { Session } from "@supabase/supabase-js";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import RootLayout from "@/app/_layout";
import { queryClient } from "@/services/query-client";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

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

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const tryAgain = () => screen.getByRole("button", { name: "Try again" });

beforeEach(() => {
  jest.useFakeTimers();
  mockProfileCalls.length = 0;
  mockReads.failFast = false;
  queryClient.clear();
  jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as never);
  jest
    .mocked(supabase.auth.onAuthStateChange)
    .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } } as never);
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

it("Try again can be pressed while her profile read is stalled, and a fresh read then opens the app", async () => {
  await render(<RootLayout />);
  await advance(5_000);

  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();
  expect(mockProfileCalls).toHaveLength(1);

  // The first read is still out. The button must be usable, not busy.
  await advance(1_000);
  expect(tryAgain().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  await advance(14_000);
  expect(tryAgain().props.accessibilityState).toMatchObject({ disabled: false, busy: false });

  await fireEvent.press(tryAgain());
  await advance(10);

  // The stalled read is cancelled and a fresh one sent; busy while it runs.
  expect(mockProfileCalls[0].signal?.aborted).toBe(true);
  expect(mockProfileCalls).toHaveLength(2);
  expect(tryAgain().props.accessibilityState).toMatchObject({ busy: true });

  await act(async () => mockProfileCalls[1].resolve(completeProfile));
  await advance(10);

  expect(screen.getByText("screen:(tabs)")).toBeTruthy();
  expect(screen.queryByText("Still trying to reach Mila")).toBeNull();
});

it("Try again is usable again once the attempt it started has failed, and she stays on the holding view", async () => {
  await render(<RootLayout />);
  await advance(5_000);

  // From here every read fails, as each would at fetchProfile's deadline.
  mockReads.failFast = true;
  await fireEvent.press(tryAgain());
  await advance(10);
  expect(tryAgain().props.accessibilityState).toMatchObject({ busy: true });

  // Her attempt and the query's own retries (1 s, then 2 s) all fail.
  await advance(5_000);

  expect(tryAgain().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
  expect(screen.queryByText("screen:onboarding")).toBeNull();
});
