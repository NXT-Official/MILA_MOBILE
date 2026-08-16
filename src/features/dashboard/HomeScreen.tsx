import { router } from "expo-router";
import { useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import { KeepAwake } from "@/components/feedback/KeepAwake";
import { PaywallSheet } from "@/components/feedback/PaywallSheet";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useCountdown } from "@/hooks/use-countdown";
import { useCreditBalance, useCredits } from "@/hooks/use-credits";
import { useHaptics } from "@/hooks/use-haptics";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useProfile } from "@/hooks/use-profile";
import { lookSections } from "@/lib/outfit-history";
import { toSeasonId } from "@/lib/season-id";
import { isStyleProfileComplete, toStyleProfileRow } from "@/lib/style-profile/completion";
import { queryKeys } from "@/constants/query-keys";
import { formatRetryAfter, resolveApiFailure } from "@/services/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { useVibeStore } from "@/stores/vibe-store";
import { useQueryClient } from "@tanstack/react-query";
import type { DailyLook } from "@/types/look";

import { ClimateWidget } from "./components/ClimateWidget";
import { DailyPaletteStrip } from "./components/DailyPaletteStrip";
import { DossierCompletionCard } from "./components/DossierCompletionCard";
import { GenerateButton, resolveBlockedReason } from "./components/GenerateButton";
import { Greeting } from "./components/Greeting";
import { HeroCard } from "./components/HeroCard";
import { HomeHeader } from "./components/HomeHeader";
import { HubSheet } from "./components/HubSheet";
import { LookActions } from "./components/LookActions";
import { LookDetail } from "@/components/ui/LookDetail";
import { OutfitVisual, type OutfitVisualState } from "./components/OutfitVisual";
import { VibePicker } from "./components/VibePicker";
import { useGenerateLook } from "./hooks/use-generate-look";
import { useLookImage } from "./hooks/use-look-image";
import { useSaveLook } from "./hooks/use-save-look";
import { useWeather } from "./hooks/use-weather";

/**
 * The screen the product is judged on.
 *
 * The two AI calls stay separate and in order: `/look/generate` charges a credit
 * and sets `look_image_pending`, then `/look/image` claims that flag so the
 * first visual is free (§6). The screen never awaits the second — the written
 * look is the product and renders as soon as it lands.
 */
export function HomeScreen() {
  const [hubSheetOpen, setHubSheetOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  /** Epoch ms the server's rate limit lifts, or null. */
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  /** True once an image attempt has come back empty for the current look. */
  const [imageAttempted, setImageAttempted] = useState(false);
  /**
   * The current visual, held here rather than read from `lookImage.data`.
   * A mutation clears its data the moment it re-runs, so a *failed regeneration*
   * would blank a visual the member already had — losing something she paid for
   * because the replacement did not arrive.
   */
  const [imageUri, setImageUri] = useState<string | null>(null);

  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const { data: profile, isPending: profilePending } = useProfile();
  const { isPending: creditsPending } = useCredits();
  const balance = useCreditBalance();
  const weather = useWeather(profile?.default_location);
  const { online } = useNetworkStatus();
  const vibe = useVibeStore((s) => s.vibe);
  const haptics = useHaptics();

  const generate = useGenerateLook();
  const lookImage = useLookImage();
  const save = useSaveLook();

  const rateLimitedFor = useCountdown(rateLimitedUntil);
  const profileComplete = isStyleProfileComplete(toStyleProfileRow(profile));
  const blocked = resolveBlockedReason({
    online,
    profileComplete,
    hasWeather: Boolean(weather.data),
    rateLimitedFor,
  });

  const look = generate.data ?? null;
  const seasonId = toSeasonId(profile?.color_season);
  const busy = generate.isPending || lookImage.isPending;

  /**
   * Every failure lands here. `kind` decides the response, so a code that is not
   * yet handled cannot silently become a blank screen — and `INSUFFICIENT_CREDITS`
   * cannot fall into the generic handler, which is the one thing §6 forbids.
   */
  function handleFailure(error: unknown) {
    const failure = resolveApiFailure(error);

    if (failure.kind === "paywall") {
      setPaywallOpen(true);
      return;
    }
    if (failure.kind === "rate-limited") {
      setRateLimitedUntil(Date.now() + (failure.retryAfterSeconds ?? 60) * 1000);
      return;
    }
    if (failure.kind === "suspended" || failure.kind === "auth") {
      // The root gate owns the redirect; re-reading the profile is what makes it
      // re-decide. One place decides where the app is, always.
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    }
  }

  function requestImage(currentLook: DailyLook) {
    setImageAttempted(true);
    // A new visual is a different look to save. Without this, the row keeps
    // saying "View in History" and offers no way to save the replacement.
    save.reset();

    lookImage.mutate(currentLook, {
      onSuccess: (result) => {
        // A null URI is a successful response, not a throw — the server has
        // already re-marked the pending flag or refunded. The previous visual,
        // if there was one, stays exactly where it is.
        if (result.imageDataUri) {
          setImageUri(result.imageDataUri);
          haptics.success();
          AccessibilityInfo.announceForAccessibility("Your look is ready.");
        }
      },
      onError: handleFailure,
    });
  }

  function handleGenerate() {
    if (!weather.data) return;
    haptics.selection();
    setImageAttempted(false);
    setImageUri(null);
    save.reset();

    generate.mutate(
      { weather: weather.data, vibe },
      {
        onSuccess: (nextLook) => {
          AccessibilityInfo.announceForAccessibility(
            `${nextLook.outfit.headline}. Rendering the visual.`,
          );
          // Fired here, after the composition lands, and never awaited by the
          // render path. The order is the billing.
          requestImage(nextLook);
        },
        onError: handleFailure,
      },
    );
  }

  function handleSave() {
    if (!look || !imageUri || !weather.data) return;
    save.mutate(
      { ...look, imageDataUri: imageUri, weather: weather.data.label, vibe },
      {
        onSuccess: () => haptics.success(),
        onError: handleFailure,
      },
    );
  }

  const visualState = resolveVisualState({
    look,
    imageUri,
    imageAttempted,
    generating: generate.isPending,
    rendering: lookImage.isPending,
    generateError: generate.isError ? resolveApiFailure(generate.error) : null,
  });

  return (
    <Screen scroll edges={{ top: true, bottom: false }}>
      {busy ? <KeepAwake /> : null}

      <View className="gap-xl pb-2xl">
        <HomeHeader
          balance={balance}
          creditsLoading={creditsPending}
          onCreditsPress={() => router.push("/membership")}
        />

        {/* Greeting, weather, mood, and the CTA are one object: everything the
            member needs to press the button lives inside the card with it. */}
        <HeroCard>
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
              blockedMessage={
                blocked === "rate-limited" ? formatRetryAfter(rateLimitedFor) : undefined
              }
              loading={generate.isPending}
              weather={weather.data}
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
        </HeroCard>

        <OutfitVisual
          state={visualState}
          onRetry={handleGenerate}
          // Free: the server re-marked the pending flag when the image came back
          // empty, so this claims it rather than buying a second one.
          onRetryImage={() => look && requestImage(look)}
        />

        <LookDetail
          headline={look?.outfit.headline ?? null}
          sections={look ? lookSections(look) : []}
          loading={generate.isPending}
        />

        {look ? (
          <LookActions
            hasVisual={Boolean(imageUri)}
            saved={save.isSuccess}
            saving={save.isPending}
            saveError={
              save.isError
                ? resolveApiFailure(save.error).message
                : // A regeneration that failed while a visual is already on
                  // screen has no slot of its own to report into.
                  lookImage.isError && imageUri
                  ? resolveApiFailure(lookImage.error).message
                  : null
            }
            onSave={handleSave}
            onRegenerate={() => setRegenerateOpen(true)}
            regenerating={lookImage.isPending}
          />
        ) : null}

        {seasonId ? <DailyPaletteStrip seasonId={seasonId} /> : null}

        <DossierCompletionCard profile={profile} />
      </View>

      <HubSheet
        visible={hubSheetOpen}
        onClose={() => setHubSheetOpen(false)}
        currentHubId={profile?.default_location ?? null}
      />

      <ConfirmSheet
        visible={regenerateOpen}
        onClose={() => setRegenerateOpen(false)}
        title="Render a new visual?"
        message="This composes a fresh image for the same look and uses 1 credit. The written look does not change."
        confirmLabel="Use 1 credit"
        loading={lookImage.isPending}
        onConfirm={() => {
          setRegenerateOpen(false);
          if (look) requestImage(look);
        }}
      />

      <PaywallSheet
        visible={paywallOpen}
        onClose={() => {
          setPaywallOpen(false);
          // Clear the failed mutation with the sheet, or the CTA stays in its
          // error state behind a paywall she has already dismissed.
          if (generate.isError) generate.reset();
          if (lookImage.isError) lookImage.reset();
        }}
      />
    </Screen>
  );
}

/**
 * Pure, so the five-state slot can be reasoned about in one place instead of
 * across a chain of ternaries in the JSX.
 */
function resolveVisualState(input: {
  look: DailyLook | null;
  imageUri: string | null;
  imageAttempted: boolean;
  generating: boolean;
  rendering: boolean;
  generateError: { kind: string; message: string } | null;
}): OutfitVisualState {
  if (input.generating) return { kind: "composing" };

  // The paywall and the rate limit have their own surfaces; the slot should not
  // also shout about them.
  if (input.generateError && input.generateError.kind !== "paywall") {
    return { kind: "failed", message: input.generateError.message };
  }

  if (!input.look) return { kind: "empty" };
  if (input.rendering) return { kind: "rendering" };
  if (input.imageUri) return { kind: "ready", imageUrl: input.imageUri };
  if (input.imageAttempted) return { kind: "image-failed" };

  return { kind: "rendering" };
}
