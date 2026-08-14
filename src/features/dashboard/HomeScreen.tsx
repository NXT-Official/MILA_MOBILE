import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { PaywallSheet } from "@/components/feedback/PaywallSheet";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { useCreditBalance, useCredits } from "@/hooks/use-credits";
import { useHaptics } from "@/hooks/use-haptics";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useProfile } from "@/hooks/use-profile";
import { isInsufficientCredits } from "@/services/api/client";
import { isStyleProfileComplete, toStyleProfileRow } from "@/lib/style-profile/completion";
import { toSeasonId } from "@/lib/season-id";
import { useVibeStore } from "@/stores/vibe-store";

import { ClimateWidget } from "./components/ClimateWidget";
import { DailyPaletteStrip } from "./components/DailyPaletteStrip";
import { GenerateButton, resolveBlockedReason } from "./components/GenerateButton";
import { Greeting } from "./components/Greeting";
import { HomeHeader } from "./components/HomeHeader";
import { HubSheet } from "./components/HubSheet";
import { LookDetail } from "./components/LookDetail";
import { OutfitVisual } from "./components/OutfitVisual";
import { VibePicker } from "./components/VibePicker";
import { useGenerateLook } from "./hooks/use-generate-look";
import { useWeather } from "./hooks/use-weather";

/**
 * The screen the product is judged on.
 *
 * Every section owns its own loading and failure shape, so a slow weather call
 * never holds up the greeting and a missing palette never blanks the page. The
 * only thing that gates the whole screen is the profile, because the greeting
 * and the hub both come out of it.
 */
export function HomeScreen() {
  const [hubSheetOpen, setHubSheetOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const { data: profile, isPending: profilePending } = useProfile();
  const { isPending: creditsPending } = useCredits();
  const balance = useCreditBalance();
  const weather = useWeather(profile?.default_location);
  const { online } = useNetworkStatus();
  const vibe = useVibeStore((s) => s.vibe);
  const generate = useGenerateLook();
  const haptics = useHaptics();

  const profileComplete = isStyleProfileComplete(toStyleProfileRow(profile));
  const blocked = resolveBlockedReason({
    online,
    profileComplete,
    hasWeather: Boolean(weather.data),
  });

  // The paywall is opened by the server's error code and nothing else (§7).
  // A local balance is never consulted here — `balance` is display only.
  const outOfCredits = isInsufficientCredits(generate.error);
  const seasonId = toSeasonId(profile?.color_season);

  function handleGenerate() {
    haptics.selection();
    generate.mutate(
      { vibe },
      { onError: (error) => setPaywallOpen(isInsufficientCredits(error)) },
    );
  }

  return (
    <Screen scroll edges={{ top: true, bottom: false }}>
      <View className="gap-xl pb-2xl">
        <HomeHeader
          balance={balance}
          creditsLoading={creditsPending}
          onCreditsPress={() => router.push("/membership")}
        />

        <Greeting fullName={profile?.full_name} loading={profilePending} />

        <ClimateWidget
          weather={weather.data}
          loading={profilePending || weather.isPending}
          hasHub={Boolean(profile?.default_location)}
          onPress={() => setHubSheetOpen(true)}
        />

        <VibePicker />

        <View className="gap-md">
          <GenerateButton
            blocked={blocked}
            loading={generate.isPending}
            onPress={handleGenerate}
          />
          {blocked === "profile-incomplete" ? (
            <Button
              label="Complete your Style Profile"
              variant="secondary"
              onPress={() => router.push("/onboarding/welcome")}
            />
          ) : null}
        </View>

        <OutfitVisual
          imageUrl={generate.data?.imageUrl}
          loading={generate.isPending}
          // Running out of credits is not a failed composition — it opens the
          // paywall, and the slot goes back to its invitation.
          error={generate.isError && !outOfCredits}
          onRetry={handleGenerate}
        />

        <LookDetail
          headline={generate.data?.headline ?? null}
          sections={generate.data?.sections ?? []}
          loading={generate.isPending}
        />

        {seasonId ? <DailyPaletteStrip seasonId={seasonId} /> : null}
      </View>

      <HubSheet
        visible={hubSheetOpen}
        onClose={() => setHubSheetOpen(false)}
        currentHubId={profile?.default_location ?? null}
      />

      <PaywallSheet
        visible={paywallOpen}
        onClose={() => {
          setPaywallOpen(false);
          // Clear the error with the sheet, or the CTA stays in its failed
          // state behind a paywall she has already dismissed.
          generate.reset();
        }}
      />
    </Screen>
  );
}
