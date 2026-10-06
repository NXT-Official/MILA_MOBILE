/**
 * The root layout's launch gate while the session is still unknown.
 *
 * Normally the native splash covers the wait. When the startup restore stalls
 * (no connection, a captive portal), a splash that never lifts looks like a
 * hung app, so the gate lifts it and shows the offline holding view instead.
 * The stack itself, with every screen it declares, is untouched.
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
jest.mock("@/features/auth/hooks/use-app-destination", () => ({ useAppDestination: jest.fn() }));
jest.mock("@/features/auth/hooks/use-auth-listener", () => ({ useAuthListener: jest.fn() }));
jest.mock("@/features/lens/components/LensSheet", () => ({ LensSheet: () => null }));
jest.mock("@/services/crash-reporting", () => ({}));
jest.mock("@/services/query-client", () => {
  const { QueryClient } = jest.requireActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { queryClient: new QueryClient() };
});
jest.mock("@/stores/lens-store", () => ({
  useLensStore: (select: (state: { open: boolean; setOpen: () => void }) => unknown) =>
    select({ open: false, setOpen: () => undefined }),
}));
jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: (select: (state: { active: boolean }) => unknown) => select({ active: false }),
}));
jest.mock("@/stores/theme-store", () => ({
  useThemeStore: (select: (state: { hydrated: boolean }) => unknown) => select({ hydrated: true }),
}));
jest.mock("@/theme/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: unknown }) => children,
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import RootLayout from "@/app/_layout";
import { useAppDestination } from "@/features/auth/hooks/use-app-destination";
import { queryClient } from "@/services/query-client";
import { useAuthStore } from "@/stores/auth-store";

const destination = useAppDestination as jest.Mock;
const hideSplash = SplashScreen.hideAsync as jest.Mock;

beforeEach(() => {
  hideSplash.mockClear();
  useAuthStore.setState({
    session: null,
    loading: true,
    recovery: false,
    launchStalled: false,
    launchAttempting: false,
    launchRetryRequests: 0,
  });
});

it("keeps the splash up while the launch is still being decided", async () => {
  destination.mockReturnValue({ ready: false, destination: "/login" });

  await render(<RootLayout />);

  expect(hideSplash).not.toHaveBeenCalled();
  expect(screen.queryByText("Still trying to reach Mila")).toBeNull();
});

it("lifts the splash and shows the offline holding view once the launch stalls", async () => {
  destination.mockReturnValue({ ready: false, destination: "/login" });
  useAuthStore.setState({ launchStalled: true });

  await render(<RootLayout />);

  expect(hideSplash).toHaveBeenCalled();
  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign in again" })).toBeTruthy();
  // The stack is held back until the destination is known.
  expect(screen.queryByText("screen:(tabs)")).toBeNull();
});

it("renders the stack, with every screen it declares, once she is in the app", async () => {
  destination.mockReturnValue({ ready: true, destination: "/" });
  useAuthStore.setState({ loading: false });

  await render(<RootLayout />);

  for (const name of [
    "(tabs)",
    "membership/index",
    "history/index",
    "palettes/index",
    "saved/index",
    "settings/index",
    "settings/account",
    "settings/location",
    "settings/privacy",
    "dossier/[field]",
    "look/[id]",
    "profile/[userId]",
    "lens-capture",
    "publish",
    "reset-password",
    "settings/support",
    "auth/callback",
  ]) {
    expect(screen.getByText(`screen:${name}`)).toBeTruthy();
  }
  expect(screen.queryByText("Still trying to reach Mila")).toBeNull();
});

it("shows the profile-stage holding view once she is signed in and only her profile is waiting", async () => {
  const retryProfile = jest.spyOn(queryClient, "refetchQueries").mockResolvedValue(undefined);
  destination.mockReturnValue({ ready: false, destination: "/" });
  useAuthStore.setState({
    loading: false,
    session: { access_token: "a", refresh_token: "r", user: { id: "member" } } as never,
    launchStalled: true,
  });

  await render(<RootLayout />);

  expect(hideSplash).toHaveBeenCalled();
  expect(screen.getByText("Still trying to reach Mila")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  await act(async () => undefined);
  expect(retryProfile).toHaveBeenCalledWith({ queryKey: ["profile", "member"] });
});
