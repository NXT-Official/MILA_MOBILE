import { render } from "@testing-library/react-native";

/**
 * `/saved` (Saved pieces) is a member screen, so it must sit behind the root
 * layout's `inApp` guard like every other one.
 *
 * Why the declaration matters: expo-router builds a navigator from every route
 * file, and `Stack.Protected` only removes the screens *declared inside it*
 * while its guard is false. A route the layout never declares is never
 * removed, so it stays reachable for a signed-out deep link.
 *
 * The real root layout renders here. expo-router itself cannot load under this
 * repo's jest transform (its ESM `standard-navigation` dependency is not
 * transformed), so `Stack` is stood in for by a component that applies exactly
 * the rule above and records the result:
 * src: expo-router 57.0.24 · build/layouts/withLayoutContext.js (useFilterScreenChildren:
 *   a screen under a false guard goes to `protectedScreens`) and build/useScreens.js
 *   (useSortedScreens: every route node stays unless it is in `protectedScreens`;
 *   declared screens come first, so the first one left is where an unavailable
 *   URL falls back to).
 */
const mockNavigator: { declared: string[]; hidden: Set<string> } = {
  declared: [],
  hidden: new Set(),
};
const mockDestination = { ready: true, destination: "/login" };

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");

  function Screen() {
    return null;
  }
  function Protected() {
    return null;
  }
  function Stack({ children }: { children: React.ReactNode }) {
    const declared: string[] = [];
    const hidden = new Set<string>();
    const flatten = (nodes: React.ReactNode, exclude: boolean) =>
      React.Children.forEach(nodes, (child: React.ReactNode) => {
        if (!React.isValidElement(child)) return;
        const element = child as React.ReactElement<{
          name?: string;
          guard?: boolean;
          children?: React.ReactNode;
        }>;
        if (element.type === Screen) {
          if (exclude) hidden.add(element.props.name as string);
          else declared.push(element.props.name as string);
        } else if (element.type === Protected) {
          flatten(element.props.children, exclude || !element.props.guard);
        }
      });
    flatten(children, false);
    mockNavigator.declared = declared;
    mockNavigator.hidden = hidden;
    return null;
  }
  Stack.Screen = Screen;
  Stack.Protected = Protected;

  return { Stack, usePathname: () => "/" };
});

jest.mock("@/theme/global.css", () => ({}));
jest.mock("@expo-google-fonts/inter/400Regular", () => ({ Inter_400Regular: 1 }));
jest.mock("@expo-google-fonts/inter/500Medium", () => ({ Inter_500Medium: 1 }));
jest.mock("@expo-google-fonts/inter/600SemiBold", () => ({ Inter_600SemiBold: 1 }));
jest.mock("@expo-google-fonts/playfair-display/700Bold", () => ({ PlayfairDisplay_700Bold: 1 }));
jest.mock("@expo-google-fonts/playfair-display/800ExtraBold", () => ({
  PlayfairDisplay_800ExtraBold: 1,
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@sentry/react-native", () => ({
  wrap: (component: unknown) => component,
  captureException: jest.fn(),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual("react");
  return {
    SafeAreaInsetsContext: React.createContext(null),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock("@/components/layout/AppHeader", () => ({ AppHeader: () => null }));
jest.mock("@/features/auth/hooks/use-app-destination", () => ({
  useAppDestination: () => mockDestination,
}));
jest.mock("@/features/auth/hooks/use-auth-listener", () => ({ useAuthListener: jest.fn() }));
jest.mock("@/features/lens/components/LensSheet", () => ({ LensSheet: () => null }));
jest.mock("@/services/crash-reporting", () => ({}));
jest.mock("@/services/query-client", () => {
  const { QueryClient } = jest.requireActual("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});
jest.mock("@/stores/lens-store", () => ({
  useLensStore: (select: (state: { open: boolean; setOpen: () => void }) => unknown) =>
    select({ open: false, setOpen: () => {} }),
}));
jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: (select: (state: { active: boolean }) => unknown) =>
    select({ active: false }),
}));
jest.mock("@/stores/theme-store", () => ({
  useThemeStore: (select: (state: { hydrated: boolean }) => unknown) =>
    select({ hydrated: true }),
}));
jest.mock("@/theme/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import RootLayout from "@/app/_layout";
import { unstable_settings as authGroup } from "@/app/(auth)/_layout";

/** What expo-router would keep for this route: anything not removed by a false guard. */
function reachable(route: string) {
  return !mockNavigator.hidden.has(route);
}

/** Where a URL that resolves to nothing available falls back: the first declared screen left. */
function fallback() {
  return mockNavigator.declared[0];
}

test("signed out, /saved is not reachable and she lands on the login screen", async () => {
  mockDestination.destination = "/login";
  await render(<RootLayout />);

  expect(reachable("saved/index")).toBe(false);
  expect(fallback()).toBe("(auth)");
  // The (auth) group opens on login.
  expect(authGroup.anchor).toBe("login");
});

test("signed in, /saved is declared with the member screens and reachable", async () => {
  mockDestination.destination = "/";
  await render(<RootLayout />);

  expect(mockNavigator.declared).toContain("saved/index");
  expect(reachable("saved/index")).toBe(true);
  // Declared beside its siblings, not as an unguarded screen after them.
  expect(mockNavigator.declared.indexOf("saved/index")).toBeLessThan(
    mockNavigator.declared.indexOf("reset-password"),
  );
});
