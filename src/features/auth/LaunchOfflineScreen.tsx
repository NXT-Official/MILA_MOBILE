import { View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuthStore } from "@/stores/auth-store";

type LaunchOfflineScreenProps = {
  /**
   * Set once she is signed in and only her profile is outstanding: Try again
   * asks for the profile, and Sign in again is not offered. Without it the
   * view serves the session restore (`use-launch-hold`'s `stage`).
   */
  profile?: { retry: () => void; retrying: boolean };
};

/**
 * The blocked (offline) state of the launch gate. Shown by the root layout in
 * place of the native splash once the launch has held a few seconds without
 * being ready: no connection, a captive portal, a dead network. A splash that
 * never lifts looks like a hung app.
 *
 * - The work keeps retrying in the background and the app opens on its own
 *   the moment it gets through.
 * - "Try again" asks for an attempt now, and shows as busy while one is out.
 * - "Sign in again" (session stage only) opens login without touching the
 *   session stored on this phone, so nothing is lost if the connection comes
 *   back first.
 *
 * The copy says "still trying" rather than "can't reach": the view also
 * appears on a connection that is slow but working (re-review N5).
 */
export function LaunchOfflineScreen({ profile }: LaunchOfflineScreenProps) {
  const attempting = useAuthStore((s) => s.launchAttempting);
  const requestLaunchRetry = useAuthStore((s) => s.requestLaunchRetry);
  const signInWhileRestoring = useAuthStore((s) => s.signInWhileRestoring);

  return (
    <Screen>
      <View className="flex-1 justify-center gap-xl" accessibilityLiveRegion="polite">
        <ErrorState
          title="Still trying to reach Mila"
          description="Your connection seems slow or offline. Mila opens on its own as soon as it gets through."
        />
        <View className="gap-sm">
          <Button
            label="Try again"
            variant="secondary"
            loading={profile ? profile.retrying : attempting}
            onPress={profile ? profile.retry : requestLaunchRetry}
          />
          {profile ? null : (
            <Button
              label="Sign in again"
              variant="ghost"
              accessibilityHint="Opens the sign-in screen. Nothing on this phone is deleted."
              onPress={signInWhileRestoring}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}
