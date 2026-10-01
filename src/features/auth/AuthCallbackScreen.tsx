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

  if (status === "success" && ready && destination !== "/login") {
    return <Redirect href={destination} />;
  }

  return (
    <Screen>
      <View className="flex-1 justify-center gap-lg">
        {status === "error" ? (
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
        {status === "error" ? (
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
