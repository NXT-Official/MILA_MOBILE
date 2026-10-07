import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { isGenerationRunning } from "@/services/api/look";
import { files } from "@/services/files";
import { newClientRequestId } from "@/services/supabase/generation-jobs";
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
import {
  NO_VISUAL,
  recoverLook,
  recoverVisual,
  type GenerationAction,
  type VisualRecovery,
} from "./generation-recovery";
import { useGenerateLook } from "./hooks/use-generate-look";
import { useGenerationImage, useGenerationJobs } from "./hooks/use-generation-jobs";
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
 *
 * Nothing she paid for is lost to the screen going away (R7). Every press sends
 * a fresh idempotency key (a double press is one request), and her latest
 * generation jobs are read on mount, on return from the background and every
 * 3 s while one runs: a look or visual that is still being made shows as such,
 * and one that finished while she was away is shown. While the server's
 * generation_jobs migration is missing, the jobs read as unavailable and the
 * screen behaves exactly as it did before.
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
  /**
   * The style sheet has finished rendering on screen. Until it has, the CTA is
   * disabled — see `renderingVisual` below.
   */
  const [sheetRendered, setSheetRendered] = useState(false);
  /**
   * Which look the screen is on. It moves every time a new look is requested,
   * and a style sheet is asked for under the run that was current — so a sheet
   * that lands after the member has moved to another look is dropped rather
   * than drawn under the wrong headline and saved with it.
   */
  const lookRun = useRef(0);
  /**
   * A press is one request (R7). These hold what is in flight synchronously, so
   * a second tap that lands before the re-render cannot send a second request:
   * the look press's key, and the look run each visual was asked for under.
   */
  const lookInFlight = useRef<string | null>(null);
  const sheetInFlightRun = useRef<number | null>(null);
  const previewInFlightRun = useRef<number | null>(null);
  /**
   * This look's latest style sheet and portrait presses: the key each sent, and
   * the job the server named when it answered "running". Cleared with every new
   * look. `...Answered` is the key whose answer arrived here, after which that
   * press's job row has nothing left to add.
   */
  const [sheetPress, setSheetPress] = useState<GenerationAction | null>(null);
  const [sheetAnswered, setSheetAnswered] = useState<string | null>(null);
  const [previewPress, setPreviewPress] = useState<GenerationAction | null>(null);
  const [previewAnswered, setPreviewAnswered] = useState<string | null>(null);

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
  const jobs = useGenerationJobs();

  const rateLimitedFor = useCountdown(rateLimitedUntil);
  const profileComplete = isStyleProfileComplete(toStyleProfileRow(profile));

  /**
   * The look: this screen's own answer first, else what her latest look job
   * says. A press on this screen only ever follows its own job, so an older
   * look never stands in for a request that failed before it reached the
   * server. `composing` covers both a request in flight here and a job still
   * running server-side (left mid-generation, or its answer lost on the way).
   */
  const lookPress: GenerationAction | null = generate.variables
    ? {
        clientRequestId: generate.variables.clientRequestId,
        followJobId: isGenerationRunning(generate.data) ? generate.data.jobId : null,
      }
    : null;
  const lookRecovery = recoverLook({ job: jobs.look, action: lookPress, nowMs: jobs.readAt });
  const lookFromPress =
    generate.data && !isGenerationRunning(generate.data) ? generate.data : null;
  const composing = generate.isPending || lookRecovery.composing;
  const look = generate.isPending ? null : (lookFromPress ?? lookRecovery.look);
  const seasonId = toSeasonId(profile?.color_season);
  const canRenderVisual = Boolean(profile?.photo_consent_at);

  /**
   * The visuals: what arrived on this screen, else the latest render job that
   * belongs to the look on screen. A press whose answer already arrived here is
   * settled; its row is not read again.
   */
  const sheetRecovery: VisualRecovery =
    look && !(sheetPress && sheetAnswered === sheetPress.clientRequestId)
      ? recoverVisual({
          job: jobs.styleSheet,
          action: sheetPress,
          lookJob: lookRecovery.job,
          nowMs: jobs.readAt,
        })
      : NO_VISUAL;
  const previewRecovery: VisualRecovery =
    look && !(previewPress && previewAnswered === previewPress.clientRequestId)
      ? recoverVisual({
          job: jobs.photoPreview,
          action: previewPress,
          lookJob: lookRecovery.job,
          nowMs: jobs.readAt,
        })
      : NO_VISUAL;
  const recoveredSheet = useGenerationImage(sheetRecovery.succeededJob);
  const recoveredPreview = useGenerationImage(previewRecovery.succeededJob);
  const shownSheetImage = recoveredSheet.image ?? sheetImage;
  const shownPreviewImage = recoveredPreview.image ?? previewImage;
  const sheetPending = styleSheet.isPending || sheetRecovery.rendering || recoveredSheet.loading;
  const previewPending =
    photoPreview.isPending || previewRecovery.rendering || recoveredPreview.loading;
  const sheetFailed = sheetRecovery.failed || recoveredSheet.failed;
  const previewFailed = previewRecovery.failed || recoveredPreview.failed;

  /**
   * The visual in flight: the server is rendering the sheet or the portrait
   * preview, or the sheet's image has arrived and is not on screen yet. The CTA
   * stays disabled the whole time — a second tap would compose (and pay for)
   * another look on top of the picture already on its way. A look with no
   * consented photo has no visual to wait for, so it never blocks.
   */
  const renderingVisual =
    Boolean(look) &&
    canRenderVisual &&
    (sheetPending || previewPending || (Boolean(shownSheetImage) && !sheetRendered));

  const blocked = resolveBlockedReason({
    online,
    profileComplete,
    hasWeather: Boolean(weather.data),
    rateLimitedFor,
    renderingVisual,
  });
  const busy = composing || sheetPending || previewPending;
  /**
   * "Try another look" composes — and charges for — a new look exactly as the
   * CTA does, so it waits on everything the CTA waits on, and on a request that
   * is already in flight.
   */
  const tryAnotherDisabled = blocked !== null || composing || sheetPending || previewPending;

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
    const run = lookRun.current;
    // One press, one request: a second tap for this look while its sheet is on
    // its way is the same press.
    if (sheetInFlightRun.current === run) return;
    sheetInFlightRun.current = run;

    // A visual she already has (drawn here or recovered from her jobs) stays
    // hers while the new one renders, and stays if the new one fails.
    if (shownSheetImage && shownSheetImage !== sheetImage) setSheetImage(shownSheetImage);
    setSheetAttempted(true);
    // A fresh render: the CTA stays disabled until this one is on screen.
    setSheetRendered(false);
    // A new visual is a different look to save. Without this, the row keeps
    // saying "View in History" and offers no way to save the replacement.
    save.reset();

    const press: GenerationAction = { clientRequestId: newClientRequestId() };
    setSheetPress(press);

    styleSheet.mutate(
      { outfit: currentLook, clientRequestId: press.clientRequestId },
      {
        onSuccess: (result) => {
          if (sheetInFlightRun.current === run) sheetInFlightRun.current = null;
          // The member has moved on to another look since this was asked for.
          // Its picture belongs to nothing on screen now.
          if (lookRun.current !== run) return;
          // Another request of this sheet is still rendering: its job is
          // followed until it settles, and nothing was charged for this one.
          if (isGenerationRunning(result)) {
            setSheetPress({ ...press, followJobId: result.jobId });
            return;
          }
          setSheetAnswered(press.clientRequestId);
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
          if (sheetInFlightRun.current === run) sheetInFlightRun.current = null;
          // The paywall and the rate limit belong to the account, not the look,
          // so they still surface; the slot's own message is for the current look.
          if (lookRun.current === run && !ownsItsOwnSurface(error)) {
            setSheetDetail(resolveApiFailure(error).message);
          }
          handleFailure(error);
        },
      },
    );
  }

  function requestPhotoPreview(currentLook: DailyLook) {
    const run = lookRun.current;
    if (previewPending || composing || previewInFlightRun.current === run) return;
    previewInFlightRun.current = run;

    if (shownPreviewImage && shownPreviewImage !== previewImage) setPreviewImage(shownPreviewImage);
    setPreviewAttempted(true);
    save.reset();

    const press: GenerationAction = { clientRequestId: newClientRequestId() };
    setPreviewPress(press);

    photoPreview.mutate(
      { outfit: currentLook, clientRequestId: press.clientRequestId },
      {
        onSuccess: (result) => {
          if (previewInFlightRun.current === run) previewInFlightRun.current = null;
          // The member has moved on to another look since this was asked for.
          // Its picture belongs to nothing on screen now.
          if (lookRun.current !== run) return;
          if (isGenerationRunning(result)) {
            setPreviewPress({ ...press, followJobId: result.jobId });
            return;
          }
          setPreviewAnswered(press.clientRequestId);
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
          if (previewInFlightRun.current === run) previewInFlightRun.current = null;
          // The account-wide surfaces (paywall, rate limit) still surface; the
          // slot's own message is for the current look.
          if (lookRun.current === run && !ownsItsOwnSurface(error)) {
            setPreviewDetail(resolveApiFailure(error).message);
          }
          handleFailure(error);
        },
      },
    );
  }

  /**
   * A look press is in flight until its answer lands here, or until the hook
   * shows it took that press and is no longer pending (an answer this screen
   * never heard, e.g. a mutation reset mid-flight, must not leave the CTA dead).
   */
  function lookPressInFlight(): boolean {
    const key = lookInFlight.current;
    if (key === null) return false;
    if (generate.variables?.clientRequestId === key && !generate.isPending) {
      lookInFlight.current = null;
      return false;
    }
    return true;
  }

  function handleGenerate() {
    // One press, one request: a second tap that lands before the re-render is
    // the same press, not a second paid look.
    if (!weather.data || lookPressInFlight()) return;
    const clientRequestId = newClientRequestId();
    lookInFlight.current = clientRequestId;
    haptics.selection();
    lookRun.current += 1;
    setSheetImage(null);
    setSheetAttempted(false);
    setSheetDetail(null);
    setSheetRendered(false);
    setSheetPress(null);
    setSheetAnswered(null);
    setPreviewImage(null);
    setPreviewAttempted(false);
    setPreviewDetail(null);
    setPreviewPress(null);
    setPreviewAnswered(null);
    save.reset();

    generate.mutate(
      {
        weather: weather.data,
        vibe,
        agenda: plan.agenda,
        dressCode: plan.dressCode,
        indoorOutdoor: plan.indoorOutdoor || undefined,
        clientRequestId,
      },
      {
        onSuccess: (nextLook) => {
          if (lookInFlight.current === clientRequestId) lookInFlight.current = null;
          // Another request of this look is still being composed: its job is
          // followed (and shown) until it settles. Nothing was charged here.
          if (isGenerationRunning(nextLook)) return;
          AccessibilityInfo.announceForAccessibility(`${nextLook.outfit.headline}.`);
          // The web's rule, verbatim: a visual requires a consented photo —
          // there is no stock-model fallback. No consent, no attempt.
          if (profile?.photo_consent_at) requestStyleSheet(nextLook);
        },
        onError: (error) => {
          if (lookInFlight.current === clientRequestId) lookInFlight.current = null;
          handleFailure(error);
        },
      },
    );
  }

  /**
   * Her own press whose answer was lost on the way (the app was in the
   * background, the connection dropped) and whose job then finished: the look
   * is on screen from its job row, so it gets the style sheet that press would
   * have asked for, once. A look recovered from a job this screen did not start
   * waits for her to ask: another device may already be drawing it.
   */
  const recoveredOwnLookJobId =
    !lookFromPress && lookRecovery.look && lookRecovery.ownRequest ? lookRecovery.job?.id : null;
  useEffect(() => {
    if (!recoveredOwnLookJobId || !look) return;
    AccessibilityInfo.announceForAccessibility(`${look.outfit.headline}.`);
    // The job row is server state that changed outside React; asking for the
    // sheet is the response to it, once per job id (the guard and the deps
    // below), so the extra render this costs happens once, not in a cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile?.photo_consent_at && !sheetPress) requestStyleSheet(look);
    // Once per recovered look: the job id is the only thing that may re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveredOwnLookJobId]);

  function handleSave() {
    // The style sheet — when it rendered — is the richer artifact, so it is
    // what gets saved.
    const imageToSave = shownSheetImage ?? shownPreviewImage;
    if (!look || !imageToSave || !weather.data) return;
    save.mutate(
      {
        ...look,
        imageDataUri: imageToSave,
        // The web's saved string, verbatim — `label (location)`, no "in",
        // unlike the generate payload.
        weather: `${weather.data.label} (${weather.data.location})`,
        vibe,
        previewMode: shownSheetImage ? "style_sheet" : "photo_edit",
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

  const sheetState: LookVisualState = sheetPending
    ? "loading"
    : shownSheetImage
      ? "ready"
      : "failed";
  const previewState: LookVisualState = previewPending
    ? "loading"
    : shownPreviewImage
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
            // `isLoading` (pending and fetching), not `isPending`: with no hub
            // the query is disabled, and a disabled query stays pending forever —
            // which would keep the skeleton up and the city picker out of reach.
            loading={profilePending || weather.isLoading}
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
              loading={composing}
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
                {look.vibe_alignment_score != null ? (
                  <Badge label={`Vibe fit ${look.vibe_alignment_score}/10`} />
                ) : null}
                {weather.data ? <Badge label={weather.data.label} /> : null}
              </View>
            ) : null}

            {composing ? (
              <View className="gap-md">
                <View
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityState={{ busy: true }}
                  accessibilityLabel="Composing your look"
                >
                  <Skeleton className="aspect-[3/4] w-full rounded-card" />
                </View>
                {/* Only promised once her jobs are recorded server-side: until
                    then, leaving can still lose the look. */}
                {jobs.available ? (
                  <Text className="font-body text-sm text-body text-center">
                    This can take a couple of minutes. You can leave the app; your look will
                    be here when you come back.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {!look && !composing ? (
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

            {look &&
            canRenderVisual &&
            (shownSheetImage || sheetAttempted || sheetPending || sheetFailed) ? (
              <View className="gap-md">
                <LookVisual
                  state={sheetState}
                  imageDataUri={shownSheetImage}
                  headline={look.outfit.headline}
                  label="Identity-locked style sheet"
                  loadingTitle="Building your style sheet…"
                  loadingHint="Rendering your identity-locked 5-view turnaround."
                  aspect="video"
                  failedMessage="The outfit is ready, but the style sheet couldn't be generated."
                  // A stored image that could not be read is read again: drawing
                  // it again would be a second render, and could be a second charge.
                  onRetry={() =>
                    recoveredSheet.failed ? recoveredSheet.retry() : requestStyleSheet(look)
                  }
                  retryDisabled={composing || sheetPending}
                  // The latch that unlocks "Create my look": only once the
                  // sheet is actually on screen.
                  onRendered={() => setSheetRendered(true)}
                  onDownload={() =>
                    shownSheetImage
                      ? handleDownload(
                          shownSheetImage,
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
                  label={
                    shownPreviewImage ? "Regenerate portrait preview" : "Generate portrait preview"
                  }
                  variant="secondary"
                  loading={previewPending}
                  disabled={composing}
                  onPress={() => requestPhotoPreview(look)}
                />

                {shownPreviewImage || previewAttempted || previewPending || previewFailed ? (
                  <View className="gap-sm">
                    <LookVisual
                      state={previewState}
                      imageDataUri={shownPreviewImage}
                      headline={look.outfit.headline}
                      label="AI-edited preview of your photo"
                      onRetry={() =>
                        recoveredPreview.failed
                          ? recoveredPreview.retry()
                          : requestPhotoPreview(look)
                      }
                      retryDisabled={composing || previewPending}
                      onDownload={() =>
                        shownPreviewImage
                          ? handleDownload(
                              shownPreviewImage,
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
              loading={composing}
            />

            {look?.shoppable_picks ? <ShopThisLookGrid items={look.shoppable_picks} /> : null}

            {look ? (
              <LookActions
                hasVisual={Boolean(shownSheetImage ?? shownPreviewImage)}
                saved={save.isSuccess}
                saving={save.isPending}
                saveError={save.isError ? resolveApiFailure(save.error).message : null}
                canRenderVisual={canRenderVisual}
                newVisualLoading={sheetPending}
                tryAnotherDisabled={tryAnotherDisabled}
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
        loading={sheetPending}
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
