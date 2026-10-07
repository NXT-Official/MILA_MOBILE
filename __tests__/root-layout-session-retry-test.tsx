/**
 * The session-stage "Try again" on the REAL launch gate, on a dead connection.
 *
 * At launch the restore runs automatic attempts; on a dead connection one can
 * be out for ~30 s (auth-js's own retries under the 15 s deadline). The button
 * used to show busy whenever an automatic attempt was out, so it could not be
 * pressed for most of that time. Busy now means only "the Try again she
 * pressed is running": pressing during an automatic attempt queues a fresh one
 * for the moment the current one ends (never two at once), and the button is
 * busy from the press until that fresh attempt resolves.
 *
 * Mounts the real root layout with the real listener, `useAppDestination`,
 * `useLaunchHold` and holding view; scripts only `getSession` and the profile
 * read; presses the button on screen.
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
// The screen-view hook reaches the real observability facade (Sentry.init).
jest.mock("@/hooks/use-screen-views", () => ({ useScreenViews: jest.fn() }));
jest.mock("@/services/observability/query-errors", () => ({ reportQueryError: jest.fn() }));
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

jest.mock("@/services/supabase/profile", () => ({
  updateStyleProfile: jest.fn(),
  fetchProfile: jest.fn(),
}));

import { AuthRetryableFetchError, type Session } from "@supabase/supabase-js";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import RootLayout from "@/app/_layout";
import { queryClient } from "@/services/query-client";
import { supabase } from "@/services/supabase/client";
import { fetchProfile } from "@/services/supabase/profile";
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
const offline = () => ({
  data: { session: null },
  error: new AuthRetryableFetchError("Network request failed", 0),
});
/** An automatic attempt on a dead connection: no answer for 30 s, then offline. */
const deadConnectionAttempt = () =>
  new Promise((resolve) => setTimeout(() => resolve(offline()), 30_000));

const getSession = jest.mocked(supabase.auth.getSession);

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const tryAgain = () => screen.getByRole("button", { name: "Try again" });

beforeEach(() => {
  jest.useFakeTimers();
  queryClient.clear();
  getSession.mockReset();
  jest
    .mocked(supabase.auth.onAuthStateChange)
    .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } } as never);
  jest.mocked(fetchProfile).mockResolvedValue(completeProfile as never);
  useAuthStore.setState({
    session: null,
    loading: true,
    recovery: false,
    launchStalled: false,
    launchAttempting: false,
    launchRetryRequests: 0,
    launchRetryRunning: false,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

it("Try again can be pressed during an automatic attempt, and a fresh attempt follows the moment it ends, never two at once", async () => {
  getSession
    .mockImplementationOnce(deadConnectionAttempt as never)
    .mockResolvedValueOnce({ data: { session }, error: null } as never);

  await render(<RootLayout />);
  await advance(6_000);

  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign in again" })).toBeTruthy();
  // The automatic attempt is still out: the button must be usable.
  expect(tryAgain().props.accessibilityState).toMatchObject({ disabled: false, busy: false });

  await fireEvent.press(tryAgain());
  await advance(10);

  // Busy from the press, and no second attempt while the first is out.
  expect(tryAgain().props.accessibilityState).toMatchObject({ busy: true });
  expect(getSession).toHaveBeenCalledTimes(1);

  // The automatic attempt ends at 30 s; the fresh one starts at once, with no
  // backoff wait, and this time the session comes back.
  await advance(24_000);
  await advance(10);

  expect(getSession).toHaveBeenCalledTimes(2);
  expect(screen.getByText("screen:(tabs)")).toBeTruthy();
  expect(screen.queryByText("Still trying to reach Mila")).toBeNull();
});

it("after the attempt she asked for fails, Try again is usable again and she stays on the holding view", async () => {
  getSession
    .mockImplementationOnce(deadConnectionAttempt as never)
    .mockResolvedValueOnce(offline() as never)
    .mockImplementation(deadConnectionAttempt as never);

  await render(<RootLayout />);
  await advance(6_000);
  await fireEvent.press(tryAgain());
  await advance(10);
  expect(tryAgain().props.accessibilityState).toMatchObject({ busy: true });

  // The automatic attempt ends at 30 s; her attempt follows and fails at once.
  await advance(24_010);

  expect(getSession).toHaveBeenCalledTimes(2);
  expect(tryAgain().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
});

it("pressed between automatic attempts, Try again starts one at once and is busy only until it ends", async () => {
  getSession
    .mockResolvedValueOnce(offline() as never)
    .mockResolvedValueOnce(offline() as never)
    .mockResolvedValueOnce(offline() as never)
    .mockResolvedValueOnce(offline() as never)
    .mockImplementation(deadConnectionAttempt as never);

  await render(<RootLayout />);
  // Attempts at 0, 1, 3 and 7 s (backoff 1, 2, 4 s); the next waits for 15 s.
  await advance(7_010);
  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
  const before = getSession.mock.calls.length;

  await fireEvent.press(tryAgain());
  await advance(10);

  expect(getSession).toHaveBeenCalledTimes(before + 1);
  expect(tryAgain().props.accessibilityState).toMatchObject({ busy: true });

  await advance(30_000);
  expect(tryAgain().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
});
