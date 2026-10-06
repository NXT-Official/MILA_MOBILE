import * as Sentry from "@sentry/react-native";
import type { ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";

import { ErrorState } from "@/components/ui/ErrorState";

/**
 * What a member sees when a screen throws while rendering. Without a boundary a
 * release build simply closes. expo-router's own fallback is a black screen that
 * prints `Error: <message>`, so the app supplies this one: plain language and one
 * way forward, never the error text.
 *
 * A caught error never reaches React's uncaught-error handler, which is how
 * crash reporting heard about these before — so it is reported here instead.
 *
 * Rendered in place of the whole route tree, outside the providers the root
 * layout mounts, so it leans on nothing but the design tokens.
 *
 * The root layout holds the native splash until its navigator hides it. A screen
 * that throws on the first render replaces that navigator, so the hide never
 * runs — this closes the splash itself, or the retry screen sits behind one that
 * never lifts.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ErrorState
        title="Something went wrong"
        description="Give it another try. If it keeps happening, close and reopen Mila."
        actionLabel="Try again"
        onAction={retry}
      />
    </View>
  );
}
