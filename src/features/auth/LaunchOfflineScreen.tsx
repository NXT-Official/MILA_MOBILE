import { View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuthStore } from "@/stores/auth-store";

/**
 * The blocked (offline) state of the launch gate. Shown by the root layout in
 * place of the native splash once the startup session restore has gone a few
 * seconds without an answer: no connection, a captive portal, a dead network.
 * A splash that never lifts looks like a hung app.
 *
 * - The restore keeps retrying in the background (`use-auth-listener`) and
 *   opens the app on its own the moment it gets through.
 * - "Try again" asks for an attempt now, and shows as busy while one is out.
 * - "Sign in again" opens login without touching the session stored on this
 *   phone, so nothing is lost if the connection comes back first.
 */
export function LaunchOfflineScreen() {
  const attempting = useAuthStore((s) => s.launchAttempting);
  const requestLaunchRetry = useAuthStore((s) => s.requestLaunchRetry);
  const signInWhileRestoring = useAuthStore((s) => s.signInWhileRestoring);

  return (
    <Screen>
      <View className="flex-1 justify-center gap-xl" accessibilityLiveRegion="polite">
        <ErrorState
          title="Can't reach Mila right now"
          description="We'll keep trying. Mila opens on its own once you're connected."
        />
        <View className="gap-sm">
          <Button
            label="Try again"
            variant="secondary"
            loading={attempting}
            onPress={requestLaunchRetry}
          />
          <Button
            label="Sign in again"
            variant="ghost"
            accessibilityHint="Opens the sign-in screen. Nothing on this phone is deleted."
            onPress={signInWhileRestoring}
          />
        </View>
      </View>
    </Screen>
  );
}
