import * as rootLayout from "@/app/_layout";
import { AppErrorBoundary } from "@/components/feedback/AppErrorBoundary";

/**
 * expo-router wraps a route in its error boundary only when the route module
 * exports one named `ErrorBoundary`. The component can be perfect and the app
 * still crash to the desktop if the root layout forgets the export, so the
 * export itself is pinned here.
 *
 * Nothing renders: the root layout's imports are stubbed because only the shape
 * of its exports is under test.
 */

jest.mock("@/theme/global.css", () => ({}));
jest.mock("@expo-google-fonts/inter/400Regular", () => ({ Inter_400Regular: 1 }));
jest.mock("@expo-google-fonts/inter/500Medium", () => ({ Inter_500Medium: 1 }));
jest.mock("@expo-google-fonts/inter/600SemiBold", () => ({ Inter_600SemiBold: 1 }));
jest.mock("@expo-google-fonts/playfair-display/700Bold", () => ({ PlayfairDisplay_700Bold: 1 }));
jest.mock("@expo-google-fonts/playfair-display/800ExtraBold", () => ({
  PlayfairDisplay_800ExtraBold: 1,
}));
jest.mock("@gorhom/bottom-sheet", () => ({ BottomSheetModalProvider: () => null }));
jest.mock("@sentry/react-native", () => ({
  wrap: (component: unknown) => component,
  captureException: jest.fn(),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("expo-router", () => ({ Stack: () => null, usePathname: () => "/" }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaInsetsContext: { Provider: () => null },
  SafeAreaProvider: () => null,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/components/layout/AppHeader", () => ({ AppHeader: () => null }));
jest.mock("@/features/auth/hooks/use-app-destination", () => ({ useAppDestination: jest.fn() }));
jest.mock("@/features/auth/hooks/use-auth-listener", () => ({ useAuthListener: jest.fn() }));
jest.mock("@/features/lens/components/LensSheet", () => ({ LensSheet: () => null }));
jest.mock("@/services/crash-reporting", () => ({}));
jest.mock("@/services/query-client", () => ({ queryClient: {} }));
jest.mock("@/stores/lens-store", () => ({ useLensStore: jest.fn() }));
jest.mock("@/stores/onboarding-store", () => ({ useOnboardingStore: jest.fn() }));
jest.mock("@/stores/theme-store", () => ({ useThemeStore: jest.fn() }));
jest.mock("@/theme/theme-provider", () => ({ ThemeProvider: () => null }));

test("the root layout exports the app's error boundary for expo-router to pick up", () => {
  expect(rootLayout.ErrorBoundary).toBe(AppErrorBoundary);
});
