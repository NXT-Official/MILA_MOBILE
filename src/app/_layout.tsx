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
import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppHeader } from "@/components/layout/AppHeader";
import { useAppDestination } from "@/features/auth/hooks/use-app-destination";
import { useAuthListener } from "@/features/auth/hooks/use-auth-listener";
import { LensSheet } from "@/features/lens/components/LensSheet";
// Imported for its side effect only, and as early as this module allows:
// `Sentry.init` needs to run before anything else in the tree can throw, so a
// crash during font loading or session resolution below is still reported.
import "@/services/crash-reporting";
import { queryClient } from "@/services/query-client";
import { useLensStore } from "@/stores/lens-store";
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
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { ready, destination } = useAppDestination();
  // Once she is inside onboarding she stays until she leaves through Review.
  // Without the latch, saving the LAST required answer (hair type) completes the
  // profile, flips this gate, and ejects her to Home — she never sees beauty
  // preferences, location, or the review. Web latches `wasCompleteAtLoad` in its
  // onboarding layout against exactly this.
  const onboardingActive = useOnboardingStore((s) => s.active);
  const lensOpen = useLensStore((s) => s.open);
  const setLensOpen = useLensStore((s) => s.setOpen);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Hold the stack back until the destination is known — rendering it first
  // would flash the wrong group for a frame on every cold start.
  //
  // A holding screen, not `null`. `ready` is not a one-shot: it drops again the
  // moment a member signs in, because a session now exists and her profile has
  // not loaded yet. On a cold start the native splash covers this view anyway,
  // but by the time she taps "Enter Mila Studio" the splash is long gone, and
  // `null` there is a blank screen for the whole length of the profile fetch —
  // the app looks like it died at the exact moment she signed in.
  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const signedOut = destination === "/login";
  const recovery = destination === "/reset-password";
  const suspended = destination === "/suspended";
  const onboarding =
    !signedOut &&
    !recovery &&
    !suspended &&
    (destination === "/onboarding/welcome" || onboardingActive);

  const inApp = !signedOut && !recovery && !suspended && !onboarding;
  const showHeader = inApp && !isFullBleed(pathname);

  return (
    // The header sits above the navigator, so it survives every push and every
    // tab change rather than being re-mounted per screen.
    <View className="flex-1 bg-canvas">
      {showHeader ? <AppHeader /> : null}

      {/* The header has already spent the top inset, so the stack below it is
          told there is none left. Doing it here means no screen had to be
          edited: `Screen`'s `edges.top` and Concierge's own `insets.top` both
          read this context and both correctly add nothing.

          Always rendered, never conditionally wrapped — swapping the element
          type around the navigator would remount it and lose the history. */}
      <SafeAreaInsetsContext.Provider
        value={showHeader ? { ...insets, top: 0 } : insets}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedOut}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>

          {/* Reachable regardless of session state: the recovery link Supabase
          emails signs the member into a temporary session, which would
          otherwise satisfy `inApp` (or even `onboarding`) and race her into
          the app before she has set a new password. `recovery` is latched
          ahead of that session existing — see `resolveDestination`. */}
          <Stack.Protected guard={recovery}>
            <Stack.Screen name="reset-password" />
          </Stack.Protected>

          <Stack.Protected guard={suspended}>
            <Stack.Screen name="suspended" />
          </Stack.Protected>

          {/* The step machine, not this guard, decides WHICH step — the group's
          initial route is the resume point, resolved inside the screen. */}
          <Stack.Protected guard={onboarding}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>

          <Stack.Protected guard={inApp}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="membership/index" />
            <Stack.Screen name="history/index" />
            <Stack.Screen name="palettes/index" />
            <Stack.Screen name="settings/index" />
            <Stack.Screen name="settings/account" />
            <Stack.Screen name="settings/location" />
            <Stack.Screen name="settings/privacy" />
            <Stack.Screen name="settings/support" />
            {/* Editing one dossier answer. Outside the `onboarding` group on
            purpose: that group is hidden once a profile is complete, and
            entering it would latch the launch gate and unmount the tabs. */}
            <Stack.Screen name="dossier/[field]" />
            {/* Deep-linkable (§4). Full-screen so a saved look fills the phone. */}
            <Stack.Screen
              name="look/[id]"
              options={{ presentation: "fullScreenModal" }}
            />
            <Stack.Screen name="profile/[userId]" />
            {/* Full-screen so the camera is not letterboxed by the tab bar (§4).
            `gestureEnabled: false` because DualCaptureScreen's own back
            handling only wires Android's hardware button (`BackHandler`) —
            iOS's edge-swipe-to-pop is a separate gesture recognizer that
            keeps running underneath unless the screen option turns it off,
            and a swipe here would pop the modal past the discard-confirmation
            it is supposed to gate. */}
            <Stack.Screen
              name="lens-capture"
              options={{ presentation: "fullScreenModal", gestureEnabled: false }}
            />
            {/* Same reason, and the dual capture also owns the back gesture while a
            shot is in hand — see DualCaptureScreen. */}
            <Stack.Screen
              name="publish"
              options={{ presentation: "fullScreenModal", gestureEnabled: false }}
            />
          </Stack.Protected>
        </Stack>
      </SafeAreaInsetsContext.Provider>

      {/* One mount, above the navigator, so the tab and the header's Lens
          control open the same sheet — and it is not clipped by whichever
          screen happens to be on top. */}
      {inApp ? (
        <LensSheet visible={lensOpen} onClose={() => setLensOpen(false)} />
      ) : null}
    </View>
  );
}

/**
 * The routes that draw to the edge of the glass and must not be capped by the
 * header: the two cameras, and a saved look whose image fills the phone. An
 * allow-list rather than a route-group restructure — three names in one place
 * beat moving nine files to express the same thing.
 */
function isFullBleed(pathname: string): boolean {
  return (
    pathname === "/lens-capture" ||
    pathname === "/publish" ||
    pathname.startsWith("/look/")
  );
}

// `Sentry.wrap` adds an error boundary and touch-event breadcrumbs around the
// whole tree at no cost when reporting is disabled — `enabled: false` (no
// DSN) makes the wrapped client a no-op, so this is safe on every developer
// machine and every build that has not been given a DSN.
function RootLayout() {
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

export default Sentry.wrap(RootLayout);
