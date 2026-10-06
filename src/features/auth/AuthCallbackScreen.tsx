import * as Linking from "expo-linking";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { completeAuthCallback } from "@/services/api/auth";

import { useAppDestination } from "./hooks/use-app-destination";
import { useLaunchHold } from "./hooks/use-launch-hold";
import { LaunchOfflineScreen } from "./LaunchOfflineScreen";

export function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const router = useRouter();
  const { ready, destination } = useAppDestination();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    url: string;
    attempt: number;
    status: "success" | "error";
  } | null>(null);
  const status = !url
    ? "error"
    : result?.url === url && result.attempt === attempt
      ? result.status
      : "verifying";

  useEffect(() => {
    let active = true;
    if (!url) return;
    completeAuthCallback(url).then(
      () => {
        if (active) setResult({ url, attempt, status: "success" });
      },
      () => {
        if (active) setResult({ url, attempt, status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [url, attempt]);

  // A callback that "succeeded" yet left no session — an expired confirmation
  // link, a listener that never fired — must not sit on the spinner forever.
  // The web lands the member back on /login in the same situation; this shows
  // the retryable error instead of verifying eternally.
  const stranded = status === "success" && ready && destination === "/login";
  const failed = status === "error" || stranded;
  // Verified, but the launch is not ready (her profile has not arrived, or
  // its read failed). The root layout does not hold this route, so the screen
  // arms the same hold: after a few seconds "Opening your studio" gives way to
  // the launch holding view, and a later successful read still redirects. A
  // failed read never routes to onboarding (`useAppDestination`).
  const hold = useLaunchHold(status === "success" && !ready);

  if (status === "success" && ready && destination !== "/login") {
    return <Redirect href={destination} />;
  }

  if (hold.stalled) {
    return (
      <LaunchOfflineScreen
        profile={
          hold.stage === "profile"
            ? { retry: hold.retryProfile, retrying: hold.profileRetrying }
            : undefined
        }
      />
    );
  }

  return (
    <Screen>
      <View className="flex-1 justify-center gap-lg">
        {failed ? (
          <ErrorState
            title="Sign-in could not finish"
            description="Check your connection and retry. If this link has expired, sign in again or request a fresh confirmation email."
            actionLabel="Retry"
            onAction={() => setAttempt((value) => value + 1)}
          />
        ) : (
          <View className="gap-md" accessibilityLiveRegion="polite">
            <Text className="font-display text-h2 text-ink">Opening your studio</Text>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Text className="font-body text-base text-body">Verifying your sign-in…</Text>
          </View>
        )}
        {failed ? (
          <Button
            label="Back to sign in"
            variant="ghost"
            onPress={() => router.replace("/login")}
          />
        ) : null}
      </View>
    </Screen>
  );
}
