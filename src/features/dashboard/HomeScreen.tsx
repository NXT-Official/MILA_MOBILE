import { router } from "expo-router";
import { useEffect, useEffectEvent, useRef, useState } from "react";
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
import { isVibe } from "@/constants/vibes";
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
import { isGenerationRunning, isLostAnswer } from "@/services/api/look";
import { files } from "@/services/files";
import {
  fetchGenerationJobByRequest,
  newClientRequestId,
  type GenerationJob,
} from "@/services/supabase/generation-jobs";
import { useAuthStore } from "@/stores/auth-store";
import { useConciergeStore } from "@/stores/concierge-store";
import {
  expiredPress,
  pendingPresses,
  retryablePress,
  useGenerationPressStore,
  type PressContext,
  type PressEntry,
  type PressKind,
} from "@/stores/generation-press-store";
import { useVibeStore } from "@/stores/vibe-store";
import type { DailyLook } from "@/types/look";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";

import { ClimateWidget } from "./components/ClimateWidget";
import { DailyPaletteGenerator } from "./components/DailyPaletteGenerator";
import { GenerateButton, resolveBlockedReason } from "./components/GenerateButton";
import { Greeting } from "./components/Greeting";
import { HeroCard } from "./components/HeroCard";
import { GettingStartedCard } from "./components/GettingStartedCard";
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
  failureNotice,
  lookAlreadySaved,
  lookKeyOf,
  NO_VISUAL,
  parseStoredLook,
  recoveredLookLabel,
  recoverLook,
  recoverVisual,
  savedWeatherOf,
  sheetNeverDrawn,
  weatherBadgeOf,
  type GenerationAction,
  type RecoveredLook,
  type VisualRecovery,
} from "./generation-recovery";
import { useGenerateLook, type GenerateLookVariables } from "./hooks/use-generate-look";
import {
  GENERATION_MUTATION_KEYS,
  useGenerationImage,
  useGenerationJobs,
} from "./hooks/use-generation-jobs";
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
/** A visual, held with the look it was drawn for: shown and saved only with that look. */
type LookImage = { lookKey: string; uri: string };
/** A press for a visual: its key, the job it was told to follow, and the look it was for. */
type VisualPress = GenerationAction & { lookKey: string };
/** The key a look press sends, what it asked for, and whether it resends an earlier one. */
type LookPressKey = { id: string; context: PressContext; resent: boolean };

/**
 * What her row says about an old unanswered look key, asked within the read's
 * own 10 s deadline: "resend" while that job runs or has finished (it is then
 * followed or replayed, one charge), and when the row cannot be read in time
 * (resending is always safe); "mint" when it failed or never arrived.
 * Module level, outside the screen: the compiler does not optimise a try block.
 */
async function oldLookKeyDecision(userId: string, id: string): Promise<"resend" | "mint"> {
  try {
    const read = await fetchGenerationJobByRequest(userId, "look", id);
    return read.status === "ok" && read.job !== null && read.job.status !== "failed"
      ? "resend"
      : "mint";
  } catch {
    return "resend";
  }
}

/** Sends an earlier look key again, its time refreshed (R-1). */
function resendLookKey(userId: string | null, entry: PressEntry, fallback: PressContext): LookPressKey {
  if (userId) useGenerationPressStore.getState().remember(userId, "look", { ...entry, at: Date.now() });
  return { id: entry.id, context: entry.context ?? fallback, resent: true };
}

function mintLookKey(userId: string | null, context: PressContext): LookPressKey {
  const id = newClientRequestId();
  if (userId) {
    useGenerationPressStore
      .getState()
      .remember(userId, "look", { id, at: Date.now(), fingerprint: null, context });
  }
  return { id, context, resent: false };
}

/**
 * The check of an old unanswered look key, one per member at a time and
 * shared by every screen: a Create on a remounted Home while the first check
 * is still asking waits for the same answer, and gets the same key, instead of
 * minting a second one (two keys would be two charges for one press).
 */
const oldKeyChecks = new Map<string, Promise<LookPressKey>>();

function resolveOldLookKey(
  userId: string,
  entry: PressEntry,
  context: PressContext,
): Promise<LookPressKey> {
  const inFlight = oldKeyChecks.get(userId);
  if (inFlight) return inFlight;
  const check = oldLookKeyDecision(userId, entry.id)
    .then((decision) => {
      if (decision === "resend") return resendLookKey(userId, entry, context);
      useGenerationPressStore.getState().settle(userId, "look", entry.id);
      return mintLookKey(userId, context);
    })
    .finally(() => oldKeyChecks.delete(userId));
  oldKeyChecks.set(userId, check);
  return check;
}

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
   * because the replacement did not arrive. Each one is held with the look it
   * was drawn for, and only ever shown or saved with that look.
   */
  const [sheetImage, setSheetImage] = useState<LookImage | null>(null);
  const [sheetAttempted, setSheetAttempted] = useState(false);
  /** The server's `unavailable` reason, or the thrown message — rendered under the slot. */
  const [sheetDetail, setSheetDetail] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<LookImage | null>(null);
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
   * the look press (its key once decided, and the hook's last submission when
   * it began), and the look run each visual was asked for under.
   */
  const lookInFlight = useRef<{ key: string | null; since: number } | null>(null);
  const sheetInFlightRun = useRef<number | null>(null);
  const previewInFlightRun = useRef<number | null>(null);
  /**
   * This look's latest style sheet and portrait presses: the key each sent, and
   * the job the server named when it answered "running". Cleared with every new
   * look. `...Answered` is the key whose answer arrived here, after which that
   * press's job row has nothing left to add.
   */
  const [sheetPress, setSheetPress] = useState<VisualPress | null>(null);
  const [sheetAnswered, setSheetAnswered] = useState<string | null>(null);
  const [previewPress, setPreviewPress] = useState<VisualPress | null>(null);
  const [previewAnswered, setPreviewAnswered] = useState<string | null>(null);
  /**
   * A look put back on screen from her job rows (R7). Held here, so a newer job
   * (another device, the web) never swaps the look she is looking at. Her next
   * Create press clears it.
   */
  const [recovered, setRecovered] = useState<RecoveredLook | null>(null);
  /** Her own look job failed out of sight (after a dropped connection or a restart). */
  const [lookNotice, setLookNotice] = useState<string | null>(null);
  /**
   * The press resent an earlier key: what that earlier press asked for. The
   * server may answer with the look it already made for it, which is shown and
   * saved as what it was, not as what she has picked since.
   */
  const [replayOf, setReplayOf] = useState<{ key: string; context: PressContext } | null>(null);
  /** When this screen's own look answer arrived (device time). */
  const [pressAnsweredAt, setPressAnsweredAt] = useState<number | null>(null);
  /** Her row for an old unanswered key is being asked before this press is sent. */
  const [resolvingPress, setResolvingPress] = useState(false);
  /** The job ids already acted on: a look is put back, or a failure told, once. */
  const adoptedJob = useRef<string | null>(null);
  const reportedJob = useRef<string | null>(null);

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
  /** Her own unanswered presses, kept across a restart (this phone's keys). */
  const presses = useGenerationPressStore((s) => s.presses);
  const pressesHydrated = useGenerationPressStore((s) => s.hydrated);
  /** A look press still in flight, also one from before a remount of this screen. */
  const lookMutations = useIsMutating({ mutationKey: GENERATION_MUTATION_KEYS.look });

  const rateLimitedFor = useCountdown(rateLimitedUntil);
  const profileComplete = isStyleProfileComplete(toStyleProfileRow(profile));

  /**
   * The look: this screen's own answer first, else a look put back from her
   * job rows. Her own unanswered press always lands; another job's look comes
   * back only onto an empty screen (`generation-recovery.ts` has the rules).
   * `composing` covers a request in flight here and a job of hers still running
   * server-side (left mid-generation, or its answer lost on the way).
   */
  const ownLookIds = userId ? (presses[userId]?.look ?? []).map((press) => press.id) : [];
  const followJobId = isGenerationRunning(generate.data) ? generate.data.jobId : null;
  const lookFromPress =
    generate.data && !isGenerationRunning(generate.data) ? generate.data : null;
  const shownLook = generate.isPending ? null : (lookFromPress ?? recovered?.look ?? null);
  const pressedHere =
    (Boolean(generate.variables) && !lookFromPress) || lookMutations > 0 || resolvingPress;
  const latestLook = jobs.look?.status === "succeeded" ? parseStoredLook(jobs.look.result) : null;
  const lookRecovery = recoverLook({
    job: jobs.look,
    shownJobId: lookFromPress ? (lookFromPress.jobId ?? null) : (recovered?.jobId ?? null),
    hasLookOnScreen: shownLook !== null,
    ownIds: ownLookIds,
    followJobId,
    pressedHere,
    saved: Boolean(jobs.look && latestLook && lookAlreadySaved(outfits.data, jobs.look, latestLook)),
    nowMs: jobs.readAt,
  });
  const composing =
    generate.isPending ||
    resolvingPress ||
    lookRecovery.composing ||
    (jobs.available && lookMutations > 0);
  const look = composing ? null : shownLook;
  const lookKey = look ? lookKeyOf(look) : null;
  const seasonId = toSeasonId(profile?.color_season);
  const canRenderVisual = Boolean(profile?.photo_consent_at);

  /**
   * A look put back from its job, or replayed by the server under an earlier
   * key, is saved and badged under the vibe and weather it was composed for:
   * its row's own when the row has been read, else what that press asked for.
   * Any look from before today says when it is from.
   */
  const recoveredOnScreen = look && !lookFromPress && recovered ? recovered : null;
  const replay =
    look && lookFromPress && replayOf && generate.variables?.clientRequestId === replayOf.key
      ? replayOf
      : null;
  const replayRow =
    replay && jobs.look?.client_request_id === replay.key ? jobs.look.look_input : null;
  const lookContext: { vibe: string | null; weather: string | null } | null =
    recoveredOnScreen ??
    (replay
      ? {
          vibe: replayRow?.vibe ?? replay.context.vibe,
          weather: replayRow?.weather ?? replay.context.weather,
        }
      : null);
  const lookVibe = lookContext?.vibe && isVibe(lookContext.vibe) ? lookContext.vibe : vibe;
  const pressJob =
    lookFromPress?.jobId && jobs.look?.id === lookFromPress.jobId ? jobs.look : null;
  const lookFinishedAt = recoveredOnScreen
    ? recoveredOnScreen.finishedAt
    : pressJob
      ? Date.parse(pressJob.completed_at ?? pressJob.created_at)
      : pressAnsweredAt;
  // The clock is the last read of her jobs (no clock in render): the label
  // appears with the first read of the new day, e.g. on coming back in the morning.
  const lookFrom =
    look && lookFinishedAt !== null && jobs.readAt > 0
      ? recoveredLookLabel(lookFinishedAt, jobs.readAt)
      : null;
  const lookWeatherBadge =
    lookFrom ?? weatherBadgeOf(lookContext?.weather ?? null) ?? weather.data?.label ?? null;

  /**
   * The visuals: what arrived on this screen for the look on screen, else the
   * latest render job drawn for that look. A press whose answer already arrived
   * here is settled; its row is not read again.
   */
  const sheetAction = sheetPress && sheetPress.lookKey === lookKey ? sheetPress : null;
  const previewAction = previewPress && previewPress.lookKey === lookKey ? previewPress : null;
  const sheetRecovery: VisualRecovery =
    look && !(sheetAction && sheetAnswered === sheetAction.clientRequestId)
      ? recoverVisual({ job: jobs.styleSheet, action: sheetAction, look, nowMs: jobs.readAt })
      : NO_VISUAL;
  const previewRecovery: VisualRecovery =
    look && !(previewAction && previewAnswered === previewAction.clientRequestId)
      ? recoverVisual({ job: jobs.photoPreview, action: previewAction, look, nowMs: jobs.readAt })
      : NO_VISUAL;
  const recoveredSheet = useGenerationImage(sheetRecovery.succeededJob);
  const recoveredPreview = useGenerationImage(previewRecovery.succeededJob);
  const shownSheetImage =
    recoveredSheet.image ?? (sheetImage && sheetImage.lookKey === lookKey ? sheetImage.uri : null);
  const shownPreviewImage =
    recoveredPreview.image ??
    (previewImage && previewImage.lookKey === lookKey ? previewImage.uri : null);
  const sheetPending = styleSheet.isPending || sheetRecovery.rendering || recoveredSheet.loading;
  const previewPending =
    photoPreview.isPending || previewRecovery.rendering || recoveredPreview.loading;
  const sheetFailed = sheetRecovery.failed || recoveredSheet.failed;
  const previewFailed = previewRecovery.failed || recoveredPreview.failed;
  /**
   * A look on screen whose style sheet was never started (put back after a
   * restart, or drawn nowhere yet): offered as not drawn, without a credit
   * claim. The server draws a look's first visual free.
   */
  const sheetNotDrawn =
    jobs.available &&
    look !== null &&
    canRenderVisual &&
    !shownSheetImage &&
    !sheetAttempted &&
    !sheetPending &&
    !sheetFailed &&
    sheetNeverDrawn(jobs.styleSheet, look);

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
  /** The phone stays awake for her own work, not for a job another device runs. */
  const busy =
    generate.isPending ||
    lookRecovery.ownComposing ||
    (jobs.available && lookMutations > 0) ||
    sheetPending ||
    previewPending;
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

  /** The server answered this press (a result or a real error): its key is spent. */
  function settlePress(kind: PressKind, id: string) {
    if (userId) useGenerationPressStore.getState().settle(userId, kind, id);
  }

  /**
   * The key a visual press sends. An earlier press of hers for the same look
   * that never heard back from the server is RESENT with its own key (its time
   * refreshed): the server replays its result, reports it running, or starts it
   * if it never arrived, so a retry after a dropped connection never pays
   * twice. A key is spent only when its row says so: failed, or succeeded and
   * already on screen (a redraw is then a new request).
   */
  function visualPressKey(
    kind: "style_sheet" | "photo_preview",
    fingerprint: string,
    latest: GenerationJob | null,
    shownJobId: string | null,
  ): string {
    if (!userId) return newClientRequestId();
    const store = useGenerationPressStore.getState();
    const now = Date.now();
    const earlier = retryablePress(pendingPresses(store, userId, kind, now), fingerprint);
    if (earlier) {
      const ended =
        latest?.client_request_id === earlier.id &&
        (latest.status === "failed" || (latest.status === "succeeded" && latest.id === shownJobId));
      if (!ended) {
        store.remember(userId, kind, { ...earlier, at: now });
        return earlier.id;
      }
      store.settle(userId, kind, earlier.id);
    }
    const id = newClientRequestId();
    store.remember(userId, kind, { id, at: now, fingerprint });
    return id;
  }

  /**
   * The key a look press sends. Her newest unanswered look key inside the 12 h
   * window is resent, whatever the phone clock thinks of its job: only her row
   * saying `failed` spends it (the server reaps a dead job before it charges,
   * so a resend is always one charge). Past the window, her row for the old
   * key is asked first (`expired`); with none, a fresh key is minted.
   */
  function lookPressKey(context: PressContext): LookPressKey | { expired: PressEntry } {
    if (!userId) return { id: newClientRequestId(), context, resent: false };
    const store = useGenerationPressStore.getState();
    const now = Date.now();
    const earlier = retryablePress(pendingPresses(store, userId, "look", now), null);
    if (earlier) {
      if (jobs.look?.client_request_id !== earlier.id || jobs.look.status !== "failed") {
        return resendLookKey(userId, earlier, context);
      }
      store.settle(userId, "look", earlier.id);
    }
    const expired = expiredPress(store, userId, "look", now);
    if (expired) return { expired };
    return mintLookKey(userId, context);
  }

  /**
   * An old unanswered key past the window: her row decides (its read has the
   * same 10 s deadline as every other). Running or finished: the old key is
   * sent again, so that job is followed or replayed (one charge). Failed or
   * never arrived: a new key. Unreadable: the old key, which is always safe.
   */
  function lookPressKeyAfterAsking(entry: PressEntry, context: PressContext): Promise<LookPressKey> {
    return userId
      ? resolveOldLookKey(userId, entry, context)
      : Promise.resolve(mintLookKey(null, context));
  }

  /**
   * The automatic save: every composed look lands in the member's history as
   * soon as its visual attempt settles — with the style sheet when one was
   * drawn, text and picks only otherwise (a look without photo consent never
   * gets a visual). The manual Save button is only ever the retry path.
   */
  function autoSaveLook(currentLook: DailyLook, imageDataUri: string | null) {
    if (!weather.data) return;
    save.mutate(
      {
        ...currentLook,
        imageDataUri,
        // The web's saved string, verbatim — `label (location)`, no "in",
        // unlike the generate payload.
        weather: `${weather.data.label} (${weather.data.location})`,
        vibe,
        previewMode: imageDataUri ? "style_sheet" : undefined,
      },
      { onError: handleFailure },
    );
  }

  function requestStyleSheet(currentLook: DailyLook, opts?: { autoSave?: boolean }) {
    const run = lookRun.current;
    // One press, one request: a second tap for this look while its sheet is on
    // its way is the same press.
    if (sheetInFlightRun.current === run) return;
    sheetInFlightRun.current = run;

    const forLook = lookKeyOf(currentLook);
    // Redrawing the same look keeps the visual she already has (drawn here or
    // recovered from her jobs) while the new one renders, and if it fails. A
    // visual is never carried over to a different look.
    if (shownSheetImage && lookKey === forLook && sheetImage?.uri !== shownSheetImage) {
      setSheetImage({ lookKey: forLook, uri: shownSheetImage });
    }
    setSheetAttempted(true);
    // A fresh render: the CTA stays disabled until this one is on screen.
    setSheetRendered(false);
    // A new visual is a different look to save. Without this, the row keeps
    // saying "View in History" and offers no way to save the replacement.
    save.reset();

    const press: VisualPress = {
      clientRequestId: visualPressKey(
        "style_sheet",
        forLook,
        jobs.styleSheet,
        recoveredSheet.image ? (sheetRecovery.succeededJob?.id ?? null) : null,
      ),
      lookKey: forLook,
    };
    setSheetPress(press);

    styleSheet.mutate(
      { outfit: currentLook, clientRequestId: press.clientRequestId },
      {
        onSuccess: (result) => {
          if (sheetInFlightRun.current === run) sheetInFlightRun.current = null;
          // "Running" is followed through its job row; any other answer spends the key.
          if (!isGenerationRunning(result)) settlePress("style_sheet", press.clientRequestId);
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
            setSheetImage({ lookKey: forLook, uri: result.imageDataUri });
            setSheetDetail(null);
            haptics.success();
            AccessibilityInfo.announceForAccessibility("Style sheet ready.");
          } else {
            setSheetDetail(result.reason);
          }
          // The automatic save waits for this attempt so the row carries the
          // sheet when there is one — and is still written when there isn't.
          // A sheet for a look she has moved on from is dropped, never saved
          // under the new one.
          if (opts?.autoSave) {
            void autoSaveLook(currentLook, result.mode === "style_sheet" ? result.imageDataUri : null);
          }
        },
        onError: (error) => {
          if (sheetInFlightRun.current === run) sheetInFlightRun.current = null;
          // No answer from the server: the key is kept, and Retry resends it.
          if (!isLostAnswer(error)) settlePress("style_sheet", press.clientRequestId);
          // A lost answer may still be drawing — it saves when its row says
          // how it ended. A real refusal settles here, text and picks only.
          if (!isLostAnswer(error) && opts?.autoSave) void autoSaveLook(currentLook, null);
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

    const forLook = lookKeyOf(currentLook);
    if (shownPreviewImage && lookKey === forLook && previewImage?.uri !== shownPreviewImage) {
      setPreviewImage({ lookKey: forLook, uri: shownPreviewImage });
    }
    setPreviewAttempted(true);
    save.reset();

    const press: VisualPress = {
      clientRequestId: visualPressKey(
        "photo_preview",
        forLook,
        jobs.photoPreview,
        recoveredPreview.image ? (previewRecovery.succeededJob?.id ?? null) : null,
      ),
      lookKey: forLook,
    };
    setPreviewPress(press);

    photoPreview.mutate(
      { outfit: currentLook, clientRequestId: press.clientRequestId },
      {
        onSuccess: (result) => {
          if (previewInFlightRun.current === run) previewInFlightRun.current = null;
          if (!isGenerationRunning(result)) settlePress("photo_preview", press.clientRequestId);
          // The member has moved on to another look since this was asked for.
          // Its picture belongs to nothing on screen now.
          if (lookRun.current !== run) return;
          if (isGenerationRunning(result)) {
            setPreviewPress({ ...press, followJobId: result.jobId });
            return;
          }
          setPreviewAnswered(press.clientRequestId);
          if (result.mode === "photo_edit") {
            setPreviewImage({ lookKey: forLook, uri: result.imageDataUri });
            setPreviewDetail(null);
            haptics.success();
            AccessibilityInfo.announceForAccessibility("Portrait preview ready.");
          } else {
            setPreviewDetail(result.reason);
          }
        },
        onError: (error) => {
          if (previewInFlightRun.current === run) previewInFlightRun.current = null;
          if (!isLostAnswer(error)) settlePress("photo_preview", press.clientRequestId);
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

  /** Every per-look visual state, for a different look (a new press or one put back). */
  function clearVisuals() {
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
  }

  /**
   * A look press is in flight until its answer lands here, or until the hook
   * shows a NEW submission since the press began and is done with it (an
   * answer this screen never heard, e.g. a mutation reset mid-flight, must not
   * leave the CTA dead). Judged by the submission, not the key: a resend has
   * the same key as the failed attempt still on screen, so a second tap before
   * the re-render would otherwise read as "already done" and send again.
   */
  function lookPressInFlight(): boolean {
    const pending = lookInFlight.current;
    if (pending === null) return false;
    if (pending.key !== null && generate.submittedAt !== pending.since && !generate.isPending) {
      lookInFlight.current = null;
      return false;
    }
    return true;
  }

  function sendLook(request: Omit<GenerateLookVariables, "clientRequestId">, key: LookPressKey) {
    const clientRequestId = key.id;
    if (lookInFlight.current) lookInFlight.current.key = clientRequestId;
    setReplayOf(key.resent ? { key: clientRequestId, context: key.context } : null);
    setPressAnsweredAt(null);

    generate.mutate(
      { ...request, clientRequestId, resent: key.resent },
      {
        onSuccess: (nextLook) => {
          if (lookInFlight.current?.key === clientRequestId) lookInFlight.current = null;
          // Another request of this look is still being composed: its job is
          // followed (and shown) until it settles. Nothing was charged here.
          if (isGenerationRunning(nextLook)) return;
          settlePress("look", clientRequestId);
          setPressAnsweredAt(Date.now());
          AccessibilityInfo.announceForAccessibility(`${nextLook.outfit.headline}.`);
          // The web's rule, verbatim: a visual requires a consented photo —
          // there is no stock-model fallback. No consent, no attempt — the
          // look still saves automatically, text and picks only.
          if (profile?.photo_consent_at) {
            requestStyleSheet(nextLook, { autoSave: true });
          } else {
            void autoSaveLook(nextLook, null);
          }
        },
        onError: (error) => {
          if (lookInFlight.current?.key === clientRequestId) lookInFlight.current = null;
          // No answer from the server: the key is kept, and Try again resends it.
          if (!isLostAnswer(error)) settlePress("look", clientRequestId);
          handleFailure(error);
        },
      },
    );
  }

  function handleGenerate() {
    // One press, one request: a second tap that lands before the re-render is
    // the same press, not a second paid look.
    if (!weather.data || lookPressInFlight()) return;
    lookInFlight.current = { key: null, since: generate.submittedAt };
    haptics.selection();
    lookRun.current += 1;
    // "Try another look" clears the look on screen and everything drawn for it at once.
    setRecovered(null);
    setLookNotice(null);
    clearVisuals();

    const request: Omit<GenerateLookVariables, "clientRequestId"> = {
      weather: weather.data,
      vibe,
      agenda: plan.agenda,
      dressCode: plan.dressCode,
      indoorOutdoor: plan.indoorOutdoor || undefined,
    };
    // The same weather string the request sends (and the row stores).
    const context: PressContext = {
      vibe,
      weather: `${weather.data.label} (in ${weather.data.location})`,
    };
    const decided = lookPressKey(context);
    if ("expired" in decided) {
      setResolvingPress(true);
      void lookPressKeyAfterAsking(decided.expired, context).then((key) => {
        setResolvingPress(false);
        sendLook(request, key);
      });
      return;
    }
    sendLook(request, decided);
  }

  /**
   * A look her job rows put back on screen (after a dropped connection, a
   * remount or a restart). Her own press continues to its style sheet as the
   * press would have, once and free: the server draws a look's first visual
   * without a charge. A look from a job this phone did not start waits for her
   * to ask: another device may already be drawing it.
   */
  const adoptRecoveredLook = useEffectEvent((next: RecoveredLook) => {
    lookRun.current += 1;
    setRecovered(next);
    setLookNotice(null);
    clearVisuals();
    if (next.own) settlePress("look", next.requestId);
    if (next.jobId === followJobId && generate.variables) {
      settlePress("look", generate.variables.clientRequestId);
    }
    AccessibilityInfo.announceForAccessibility(`${next.look.outfit.headline}.`);
    if (next.own && profile?.photo_consent_at && sheetNeverDrawn(jobs.styleSheet, next.look)) {
      requestStyleSheet(next.look, { autoSave: true });
    } else if (next.own) {
      // A look that already has its sheet (or a look with no visual to draw)
      // still lands in her history, once, with the sheet when it is loaded.
      void autoSaveLook(next.look, recoveredSheet.image ?? null);
    }
  });
  const candidate = lookRecovery.candidate;
  // Her own press waits only for this phone's keys to be read back; another
  // job's look also waits for her History, so a saved look is not put back.
  const candidateReady = pressesHydrated && (candidate?.own === true || !outfits.isPending);
  useEffect(() => {
    if (!candidate || !candidateReady || adoptedJob.current === candidate.jobId) return;
    adoptedJob.current = candidate.jobId;
    adoptRecoveredLook(candidate);
  }, [candidate, candidateReady]);

  /**
   * Her own look job that ended without a look she could see: its key is spent,
   * and a real failure says whether her credit is back (the row's word, §7).
   * Delivered-but-unsaved was charged and handed over: never a failure (N7).
   * Only the row saying `failed` ends it: a job the phone clock calls dead may
   * still be running, and its key must stay hers (it is resent, never replaced).
   */
  const reportOwnLookEnded = useEffectEvent((job: GenerationJob) => {
    settlePress("look", job.client_request_id);
    const notice = failureNotice(job);
    if (notice) setLookNotice(notice);
  });
  const ownEndedJob =
    jobs.look && ownLookIds.includes(jobs.look.client_request_id) && jobs.look.status === "failed"
      ? jobs.look
      : null;
  useEffect(() => {
    if (!ownEndedJob || reportedJob.current === ownEndedJob.id) return;
    reportedJob.current = ownEndedJob.id;
    reportOwnLookEnded(ownEndedJob);
  }, [ownEndedJob]);

  function handleSave() {
    // The style sheet — when it rendered — is the richer artifact, so it is
    // what gets saved.
    const imageToSave = shownSheetImage ?? shownPreviewImage;
    // The web's saved string, verbatim — `label (location)`, no "in", unlike
    // the generate payload. A look put back from its job, or replayed under an
    // earlier key, is saved under the weather it was composed for.
    const savedWeather = lookContext?.weather
      ? savedWeatherOf(lookContext.weather)
      : weather.data
        ? `${weather.data.label} (${weather.data.location})`
        : null;
    if (!look || !savedWeather) return;
    // One generation, one row: while the automatic save is in flight the
    // manual button waits rather than writing a duplicate.
    if (save.isPending) return;
    save.mutate(
      {
        ...look,
        imageDataUri: imageToSave ?? null,
        weather: savedWeather,
        vibe: lookVibe,
        previewMode: imageToSave ? (shownSheetImage ? "style_sheet" : "photo_edit") : undefined,
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
  /** Her own job's ending, when known, says more than the dropped call did. */
  const lookFailureMessage = lookNotice ?? generateError?.message ?? null;

  return (
    <Screen scroll edges={{ top: true, bottom: false }}>
      {busy ? <KeepAwake /> : null}

      <View className="gap-xl pb-2xl">
        {/* Before the hero: for a new member this is the only thing that says
            what to do. It disappears once all three moves are done. */}
        {!profilePending && !outfits.isPending ? (
          <GettingStartedCard
            profilePercent={profile ? styleProfileCompletionPercent(toStyleProfileRow(profile)) : 0}
            hasPhotoConsent={Boolean(profile?.photo_consent_at)}
            hasComposedLook={(outfits.data?.length ?? 0) > 0}
          />
        ) : null}

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
                <Badge label={lookVibe} />
                {look.vibe_alignment_score != null ? (
                  <Badge label={`Vibe fit ${look.vibe_alignment_score}/10`} />
                ) : null}
                {lookWeatherBadge ? <Badge label={lookWeatherBadge} /> : null}
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
              lookFailureMessage ? (
                <View className="items-center gap-md py-lg">
                  <Icon name="alert" size="lg" color="muted" />
                  <Text className="font-display text-h3 text-ink text-center">
                    That didn&apos;t come together
                  </Text>
                  <Text
                    accessibilityLiveRegion="assertive"
                    className="font-body text-base text-body text-center"
                  >
                    {lookFailureMessage}
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

            {sheetNotDrawn && look ? (
              <EmptyMediaState
                aspect="video"
                message="Your look is ready. Its style sheet hasn't been drawn yet."
                action={
                  <Button
                    label="Draw style sheet"
                    variant="secondary"
                    icon="sparkle"
                    disabled={composing}
                    onPress={() => requestStyleSheet(look)}
                  />
                }
              />
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
                  failedMessage={
                    recoveredSheet.failed
                      ? "Your style sheet is ready, but it couldn't be loaded."
                      : "The outfit is ready, but the style sheet couldn't be generated."
                  }
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
                      failedMessage={
                        recoveredPreview.failed
                          ? "Your portrait preview is ready, but it couldn't be loaded."
                          : undefined
                      }
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
                saved={save.isSuccess}
                saving={save.isPending}
                saveError={save.isError ? resolveApiFailure(save.error).message : null}
                // While the first sheet is not drawn, the slot's own button draws it
                // (free); "New visual" and its 1 credit are for a redraw.
                canRenderVisual={canRenderVisual && !sheetNotDrawn}
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
