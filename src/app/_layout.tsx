import "@/theme/global.css";

// Imported by weight subpath, never from the package barrel. The barrel
// `require`s every weight, which Metro cannot tree-shake: the index import
// bundled 31 TTFs (~5MB) for the 5 faces Mila actually uses.
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { PlayfairDisplay_800ExtraBold } from "@expo-google-fonts/playfair-display/800ExtraBold";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAppDestination } from "@/features/auth/hooks/use-app-destination";
import { useAuthListener } from "@/features/auth/hooks/use-auth-listener";
import { queryClient } from "@/services/query-client";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useThemeStore } from "@/stores/theme-store";
import { ThemeProvider } from "@/theme/theme-provider";

SplashScreen.preventAutoHideAsync();

/**
 * The session gate. Guards live here and nowhere else, so there is exactly one
 * place the redirect can be wrong.
 *
 * Guards are a UX convenience — the server re-verifies the JWT and suspension
 * on every call regardless (§4).
 */
function RootNavigator() {
  useAuthListener();
  const { ready, destination } = useAppDestination();
  // Once she is inside onboarding she stays until she leaves through Review.
  // Without the latch, saving the LAST required answer (hair type) completes the
  // profile, flips this gate, and ejects her to Home — she never sees beauty
  // preferences, location, or the review. Web latches `wasCompleteAtLoad` in its
  // onboarding layout against exactly this.
  const onboardingActive = useOnboardingStore((s) => s.active);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Keep the native splash up until the destination is known. Rendering the
  // stack first would flash the wrong screen for a frame on every cold start.
  if (!ready) return null;

  const signedOut = destination === "/login";
  const suspended = destination === "/suspended";
  const onboarding =
    !signedOut && !suspended && (destination === "/onboarding/welcome" || onboardingActive);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedOut}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={suspended}>
        <Stack.Screen name="suspended" />
      </Stack.Protected>

      {/* The step machine, not this guard, decides WHICH step — the group's
          initial route is the resume point, resolved inside the screen. */}
      <Stack.Protected guard={onboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={!signedOut && !suspended && !onboarding}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="membership/index" />
        {/* Full-screen so the camera is not letterboxed by the tab bar (§4). */}
        <Stack.Screen name="lens-capture" options={{ presentation: "fullScreenModal" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const themeHydrated = useThemeStore((s) => s.hydrated);

  // A font error must not hang the splash forever.
  const shellReady = (fontsLoaded || Boolean(fontError)) && themeHydrated;
  if (!shellReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            {/* Sheets portal to the root, so the provider has to sit above the
                navigator or a sheet renders clipped inside its own screen. */}
            <BottomSheetModalProvider>
              <RootNavigator />
            </BottomSheetModalProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
