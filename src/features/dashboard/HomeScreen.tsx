import { router } from "expo-router";
import { useState } from "react";
import { AccessibilityInfo, Text, View } from "react-native";

import { KeepAwake } from "@/components/feedback/KeepAwake";
import { PaywallSheet } from "@/components/feedback/PaywallSheet";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyMediaState } from "@/components/ui/EmptyMediaState";
import { Icon } from "@/components/ui/Icon";
import { LookDetail } from "@/components/ui/LookDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import { queryKeys } from "@/constants/query-keys";
import { useCountdown } from "@/hooks/use-countdown";
import { useHaptics } from "@/hooks/use-haptics";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useOutfits } from "@/hooks/use-outfits";
import { useProfile } from "@/hooks/use-profile";
import { lookSections, headlineSlug } from "@/lib/outfit-history";
import { looksThisMonth, styleProfileCompletionPercent } from "@/lib/dashboard-stats";
import { toSeasonId } from "@/lib/season-id";
import { isStyleProfileComplete, toStyleProfileRow } from "@/lib/style-profile/completion";
import { formatRetryAfter, resolveApiFailure } from "@/services/api/client";
import { files } from "@/services/files";
import { useAuthStore } from "@/stores/auth-store";
import { useConciergeStore } from "@/stores/concierge-store";
import { useVibeStore } from "@/stores/vibe-store";
import type { DailyLook } from "@/types/look";
import { useQueryClient } from "@tanstack/react-query";

import { ClimateWidget } from "./components/ClimateWidget";
import { DailyPaletteGenerator } from "./components/DailyPaletteGenerator";
import { GenerateButton, resolveBlockedReason } from "./components/GenerateButton";
import { Greeting } from "./components/Greeting";
import { HeroCard } from "./components/HeroCard";
import { HubSheet } from "./components/HubSheet";
import { LookActions } from "./components/LookActions";
import { LookVisual, type LookVisualState } from "./components/LookVisual";
import { RecentLooksStrip } from "./components/RecentLooksStrip";
import { SelfiePhotoWidget } from "./components/SelfiePhotoWidget";
import { ShopThisLookGrid } from "./components/ShopThisLookGrid";
import { StatsRow } from "./components/StatsRow";
import { EMPTY_TODAY_PLAN, TodayPlanFields, type TodayPlan } from "./components/TodayPlanFields";
import { VibePicker, VibeSheet } from "./components/VibePicker";
import { useGenerateLook } from "./hooks/use-generate-look";
import { usePhotoPreview } from "./hooks/use-photo-preview";
import { useSaveLook } from "./hooks/use-save-look";
import { useStyleSheet } from "./hooks/use-style-sheet";
import { useWeather } from "./hooks/use-weather";

/**
 * The screen the product is judged on.
 *
 * The two AI calls stay separate and in order: `/look/generate` charges a
 * credit and sets `look_image_pending`, then the style sheet claims that flag
 * so the first visual is free (§6). The screen never awaits the visual — the
 * written look is the product and renders as soon as it lands.
 *
 * There is no stock-model fallback anymore: a visual requires a consented
 * photo, because the identity-locked style sheet is the only auto-generated
 * image. Without consent the media slot says so and the CTA is the whole flow.
 */
export function HomeScreen() {
  const [hubSheetOpen, setHubSheetOpen] = useState(false);
  /** True when the hub sheet was opened by the pin rather than the city row. */
  const [hubAutoLocate, setHubAutoLocate] = useState(false);
  const [vibeSheetOpen, setVibeSheetOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [newVisualOpen, setNewVisualOpen] = useState(false);
  /** Epoch ms the server's rate limit lifts, or null. */
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [plan, setPlan] = useState<TodayPlan>(EMPTY_TODAY_PLAN);

  /**
   * The visuals, held here rather than read from the mutations. A mutation
   * clears its data the moment it re-runs, so a *failed regeneration* would
   * blank a visual the member already had — losing something she paid for
   * because the replacement did not arrive.
   */
  const [sheetImage, setSheetImage] = useState<string | null>(null);
  const [sheetAttempted, setSheetAttempted] = useState(false);
  /** The server's `unavailable` reason, or the thrown message — rendered under the slot. */
  const [sheetDetail, setSheetDetail] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewAttempted, setPreviewAttempted] = useState(false);
  const [previewDetail, setPreviewDetail] = useState<string | null>(null);

  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const { data: profile, isPending: profilePending } = useProfile();
  /** The member's own saved rows — the same query History owns, for the strip. */
  const outfits = useOutfits();
  const weather = useWeather(profile?.default_location);
  const { online } = useNetworkStatus();
  const vibe = useVibeStore((s) => s.vibe);
  const haptics = useHaptics();
  const anchorLook = useConciergeStore((s) => s.anchor);

  const generate = useGenerateLook();
  const styleSheet = useStyleSheet();
  const photoPreview = usePhotoPreview();
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
  const canRenderVisual = Boolean(profile?.photo_consent_at);
  const busy = generate.isPending || styleSheet.isPending || photoPreview.isPending;

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

  /** True when the failure has a surface of its own and the media slot should stay quiet. */
  function ownsItsOwnSurface(error: unknown): boolean {
    const kind = resolveApiFailure(error).kind;
    return kind === "paywall" || kind === "rate-limited" || kind === "suspended" || kind === "auth";
  }

  function requestStyleSheet(currentLook: DailyLook) {
    setSheetAttempted(true);
    // A new visual is a different look to save. Without this, the row keeps
    // saying "View in History" and offers no way to save the replacement.
    save.reset();

    styleSheet.mutate(currentLook, {
      onSuccess: (result) => {
        // `unavailable` is a successful response, not a throw — the server has
        // already re-marked the pending flag or refunded. The previous visual,
        // if there was one, stays exactly where it is.
        if (result.mode === "style_sheet") {
          setSheetImage(result.imageDataUri);
          setSheetDetail(null);
          haptics.success();
          AccessibilityInfo.announceForAccessibility("Style sheet ready.");
        } else {
          setSheetDetail(result.reason);
        }
      },
      onError: (error) => {
        if (!ownsItsOwnSurface(error)) setSheetDetail(resolveApiFailure(error).message);
        handleFailure(error);
      },
    });
  }

  function requestPhotoPreview(currentLook: DailyLook) {
    if (photoPreview.isPending || generate.isPending) return;
    setPreviewAttempted(true);
    save.reset();

    photoPreview.mutate(currentLook, {
      onSuccess: (result) => {
        if (result.mode === "photo_edit") {
          setPreviewImage(result.imageDataUri);
          setPreviewDetail(null);
          haptics.success();
          AccessibilityInfo.announceForAccessibility("Portrait preview ready.");
        } else {
          setPreviewDetail(result.reason);
        }
      },
      onError: (error) => {
        if (!ownsItsOwnSurface(error)) setPreviewDetail(resolveApiFailure(error).message);
        handleFailure(error);
      },
    });
  }

  function handleGenerate() {
    if (!weather.data) return;
    haptics.selection();
    setSheetImage(null);
    setSheetAttempted(false);
    setSheetDetail(null);
    setPreviewImage(null);
    setPreviewAttempted(false);
    setPreviewDetail(null);
    save.reset();

    generate.mutate(
      {
        weather: weather.data,
        vibe,
        agenda: plan.agenda,
        dressCode: plan.dressCode,
        indoorOutdoor: plan.indoorOutdoor || undefined,
      },
      {
        onSuccess: (nextLook) => {
          AccessibilityInfo.announceForAccessibility(`${nextLook.outfit.headline}.`);
          // The web's rule, verbatim: a visual requires a consented photo —
          // there is no stock-model fallback. No consent, no attempt.
          if (profile?.photo_consent_at) requestStyleSheet(nextLook);
        },
        onError: handleFailure,
      },
    );
  }

  function handleSave() {
    // The style sheet — when it rendered — is the richer artifact, so it is
    // what gets saved.
    const imageToSave = sheetImage ?? previewImage;
    if (!look || !imageToSave || !weather.data) return;
    save.mutate(
      {
        ...look,
        imageDataUri: imageToSave,
        // The web's saved string, verbatim — `label (location)`, no "in",
        // unlike the generate payload.
        weather: `${weather.data.label} (${weather.data.location})`,
        vibe,
        previewMode: sheetImage ? "style_sheet" : "photo_edit",
      },
      {
        onSuccess: () => haptics.success(),
        onError: handleFailure,
      },
    );
  }

  function handleDownload(imageDataUri: string, filename: string) {
    // The decoder throws on anything that is not a base64 data URI — which is
    // exactly right here: a share sheet handed a corrupt file is worse than a
    // share sheet that never opened. The MIME comes from the URI itself, same
    // as the storage upload.
    void files.saveAndShareImage({ filename, dataUri: imageDataUri });
  }

  function handleAskConcierge() {
    const saved = save.data;
    if (!saved || !look) return;
    anchorLook({ id: saved.id, imageUrl: saved.image_url, headline: look.outfit.headline });
    router.push("/concierge");
  }

  const sheetState: LookVisualState = styleSheet.isPending
    ? "loading"
    : sheetImage
      ? "ready"
      : "failed";
  const previewState: LookVisualState = photoPreview.isPending
    ? "loading"
    : previewImage
      ? "ready"
      : "failed";
  // The paywall and the rate limit have their own surfaces; the slot should not
  // also shout about them.
  const generateError =
    generate.isError && !ownsItsOwnSurface(generate.error) ? resolveApiFailure(generate.error) : null;

  return (
    <Screen scroll edges={{ top: true, bottom: false }}>
      {busy ? <KeepAwake /> : null}

      <View className="gap-xl pb-2xl">
        {/* Greeting, weather, mood, and the CTA are one object: everything the
            member needs to press the button lives inside the card with it. */}
        <HeroCard>
          <Greeting fullName={profile?.full_name} loading={profilePending} />

          {/* The web's hero line: what Mila is styling for, and the way back to
              change it. Absent entirely until the gender step has an answer. */}
          {profile?.gender ? (
            <Text className="font-body text-sm text-body">
              Styling for {profile.gender}
              {profile.gender !== "Male"
                ? ` · Makeup: ${
                    profile.makeup_preference && profile.makeup_preference !== "none"
                      ? profile.makeup_preference
                      : "off"
                  }`
                : ""}
              {" · "}
              <Text
                accessibilityRole="link"
                accessibilityLabel="Change your style profile"
                onPress={() => router.push("/studio")}
                className="underline"
              >
                Change
              </Text>
            </Text>
          ) : null}

          <ClimateWidget
            weather={weather.data}
            loading={profilePending || weather.isPending}
            hasHub={Boolean(profile?.default_location)}
            onPress={() => {
              setHubAutoLocate(false);
              setHubSheetOpen(true);
            }}
            onUseLocation={() => {
              setHubAutoLocate(true);
              setHubSheetOpen(true);
            }}
          />

          <VibePicker onPress={() => setVibeSheetOpen(true)} />

          <TodayPlanFields value={plan} onChange={setPlan} />

          <SelfiePhotoWidget hasConsent={Boolean(profile?.photo_consent_at)} />

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

          {/* The result lives inside the hero, as it does on the web: the look
              and the controls that produced it are one object, not a card
              answering another card. */}
          <View className="gap-xl pt-lg">
            {look ? (
              <View className="flex-row flex-wrap items-center gap-sm">
                <Badge label={vibe} />
                <Badge label={`Vibe fit ${look.vibe_alignment_score}/10`} />
                {weather.data ? <Badge label={weather.data.label} /> : null}
              </View>
            ) : null}

            {generate.isPending ? (
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityState={{ busy: true }}
                accessibilityLabel="Composing your look"
              >
                <Skeleton className="aspect-[3/4] w-full rounded-card" />
              </View>
            ) : null}

            {!look && !generate.isPending ? (
              generateError ? (
                <View className="items-center gap-md py-lg">
                  <Icon name="alert" size="lg" color="muted" />
                  <Text className="font-display text-h3 text-ink text-center">
                    That didn&apos;t come together
                  </Text>
                  <Text
                    accessibilityLiveRegion="assertive"
                    className="font-body text-base text-body text-center"
                  >
                    {generateError.message}
                  </Text>
                  <Button label="Try again" variant="secondary" onPress={handleGenerate} />
                </View>
              ) : (
                <View className="items-center gap-md py-lg">
                  <Text
                    accessibilityRole="header"
                    className="font-display text-h2 tracking-heading text-ink text-center"
                  >
                    Set the mood. Mila will compose the rest.
                  </Text>
                  <Text className="font-body text-base text-body text-center">
                    Each look is composed from the live shop inventory — tuned to your palette, body
                    architecture, and the weather outside.
                  </Text>
                </View>
              )
            ) : null}

            {look && !canRenderVisual ? (
              <EmptyMediaState
                aspect="video"
                message="Add a consented photo above to generate your style sheet."
              />
            ) : null}

            {look && canRenderVisual && (sheetImage || sheetAttempted || styleSheet.isPending) ? (
              <View className="gap-md">
                <LookVisual
                  state={sheetState}
                  imageDataUri={sheetImage}
                  headline={look.outfit.headline}
                  label="Identity-locked style sheet"
                  loadingTitle="Building your style sheet…"
                  loadingHint="Rendering your identity-locked 5-view turnaround."
                  aspect="video"
                  failedMessage="The outfit is ready, but the style sheet couldn't be generated."
                  onRetry={() => requestStyleSheet(look)}
                  retryDisabled={generate.isPending || styleSheet.isPending}
                  onDownload={() =>
                    sheetImage
                      ? handleDownload(
                          sheetImage,
                          `mila-style-sheet-${headlineSlug(look.outfit.headline)}.jpg`,
                        )
                      : undefined
                  }
                />
                {sheetDetail ? (
                  <Text accessibilityLiveRegion="polite" className="font-body text-sm text-muted">
                    {sheetDetail}
                  </Text>
                ) : null}

                <Button
                  label={previewImage ? "Regenerate portrait preview" : "Generate portrait preview"}
                  variant="secondary"
                  loading={photoPreview.isPending}
                  disabled={generate.isPending}
                  onPress={() => requestPhotoPreview(look)}
                />

                {previewImage || previewAttempted || photoPreview.isPending ? (
                  <View className="gap-sm">
                    <LookVisual
                      state={previewState}
                      imageDataUri={previewImage}
                      headline={look.outfit.headline}
                      label="AI-edited preview of your photo"
                      onRetry={() => requestPhotoPreview(look)}
                      retryDisabled={generate.isPending || photoPreview.isPending}
                      onDownload={() =>
                        previewImage
                          ? handleDownload(
                              previewImage,
                              `mila-${headlineSlug(look.outfit.headline)}.jpg`,
                            )
                          : undefined
                      }
                    />
                    {previewDetail ? (
                      <Text
                        accessibilityLiveRegion="polite"
                        className="font-body text-sm text-muted"
                      >
                        {previewDetail}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            <LookDetail
              headline={look?.outfit.headline ?? null}
              sections={look ? lookSections(look) : []}
              loading={generate.isPending}
            />

            {look?.shoppable_picks ? <ShopThisLookGrid items={look.shoppable_picks} /> : null}

            {look ? (
              <LookActions
                hasVisual={Boolean(sheetImage ?? previewImage)}
                saved={save.isSuccess}
                saving={save.isPending}
                saveError={save.isError ? resolveApiFailure(save.error).message : null}
                canRenderVisual={canRenderVisual}
                newVisualLoading={styleSheet.isPending}
                canAskMila={save.isSuccess}
                onSave={handleSave}
                onNewVisual={() => setNewVisualOpen(true)}
                onTryAnother={handleGenerate}
                onAskConcierge={handleAskConcierge}
              />
            ) : null}
          </View>
        </HeroCard>

        {seasonId ? <DailyPaletteGenerator seasonId={seasonId} /> : null}

        {/* The web's dashboard tail, below the look: the two tiles mobile
            carries, then the recent-looks strip. The strip's "View all" is a
            History entry point where the web's quick-action row put one. */}
        <View className="gap-xl pt-xl">
          <StatsRow
            profilePercent={
              profile ? styleProfileCompletionPercent(toStyleProfileRow(profile)) : 0
            }
            profileLoading={profilePending}
            looksThisMonth={outfits.data ? looksThisMonth(outfits.data) : 0}
            looksLoading={outfits.isPending}
          />

          <RecentLooksStrip
            looks={outfits.data}
            loading={outfits.isPending}
            onExpired={() => void outfits.refetch()}
          />
        </View>
      </View>

      {/* Every sheet is mounted here, at the screen root — never inside
          `HeroCard`, whose `overflow-hidden` would clip anything that failed to
          portal cleanly. */}
      <HubSheet
        visible={hubSheetOpen}
        onClose={() => setHubSheetOpen(false)}
        currentHubId={profile?.default_location ?? null}
        autoLocate={hubAutoLocate}
      />

      <VibeSheet visible={vibeSheetOpen} onClose={() => setVibeSheetOpen(false)} />

      <ConfirmSheet
        visible={newVisualOpen}
        onClose={() => setNewVisualOpen(false)}
        title="Draw a new style sheet?"
        message="This renders a fresh 5-view sheet for the same look and uses 1 credit. The written look does not change."
        confirmLabel="Use 1 credit"
        loading={styleSheet.isPending}
        onConfirm={() => {
          setNewVisualOpen(false);
          if (look) requestStyleSheet(look);
        }}
      />

      <PaywallSheet
        visible={paywallOpen}
        onClose={() => {
          setPaywallOpen(false);
          // Clear the failed mutation with the sheet, or the CTA stays in its
          // error state behind a paywall she has already dismissed.
          if (generate.isError) generate.reset();
        }}
      />
    </Screen>
  );
}
