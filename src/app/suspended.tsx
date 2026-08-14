import { Linking, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useSignOut } from "@/hooks/use-sign-out";

/**
 * A full-screen block with exactly two actions (§10). No navigation away, no
 * tabs, no way back into the app — the server rejects every call with
 * ACCOUNT_SUSPENDED regardless, so offering more would only mislead.
 */
export default function SuspendedScreen() {
  const signOut = useSignOut();

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-xl">
        <ErrorState
          title="Your account is on hold"
          description="Access to Mila has been paused. The studio steward can tell you why and what happens next."
        />
        <View className="w-full gap-md px-xl">
          <Button
            label="Contact the steward"
            size="lg"
            onPress={() =>
              Linking.openURL("mailto:hello@mila.app?subject=Account%20on%20hold")
            }
          />
          <Button
            label="Sign out"
            variant="secondary"
            size="lg"
            loading={signOut.isPending}
            onPress={() => signOut.mutate()}
          />
        </View>
      </View>
    </Screen>
  );
}
