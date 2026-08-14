import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeepAwake } from "@/components/feedback/KeepAwake";
import { PaywallSheet } from "@/components/feedback/PaywallSheet";
import { Screen } from "@/components/layout/Screen";
import { CameraPermissionPrompt } from "@/components/media/CameraPermissionPrompt";
import { ShutterControls } from "@/components/media/ShutterControls";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { queryKeys } from "@/constants/query-keys";
import { useCountdown } from "@/hooks/use-countdown";
import { useHaptics } from "@/hooks/use-haptics";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useProfile } from "@/hooks/use-profile";
import { isStyleProfileComplete, toStyleProfileRow } from "@/lib/style-profile/completion";
import { formatRetryAfter, resolveApiFailure } from "@/services/api/client";
import {
  CameraPreview,
  camera,
  type CameraHandle,
  type CapturedPhoto,
  type Facing,
  type PermissionStatus,
} from "@/services/camera";
import { useAuthStore } from "@/stores/auth-store";
import { radii } from "@/theme/tokens";
import { useQueryClient } from "@tanstack/react-query";

import { AnalysisResultCard } from "./components/AnalysisResultCard";
import { AnalysisSkeleton } from "./components/AnalysisSkeleton";
import { CapturedPreview } from "./components/CapturedPreview";
import { useAnalyzeOutfit } from "./hooks/use-analyze-outfit";

/**
 * Lens, presented full-screen so the camera is not letterboxed by the tab bar.
 *
 * States in the §3 order: permission → live preview → captured preview →
 * analysing → result → saved. Every one of them is local `useState`: a capture
 * that does not survive navigation does not need a store, and the analysis
 * itself is server state that TanStack Query already owns.
 *
 * Nothing in this file knows which operating system it is running on. The
 * camera, its permission semantics, and the image format all sit behind
 * `services/camera` (§12).
 */
export function LensCaptureScreen() {
  const insets = useSafeAreaInsets();

  /** Null while the first, non-prompting permission read is in flight. */
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [facing, setFacing] = useState<Facing>("back");
  const [previewReady, setPreviewReady] = useState(false);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [capturing, setCapturing] = useState(false);
  /** A camera or gallery failure — distinct from an analysis failure. */
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  /** Epoch ms the server's rate limit lifts, or null. */
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  const handle = useRef<CameraHandle>(null);

  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { online } = useNetworkStatus();
  const haptics = useHaptics();
  const analyse = useAnalyzeOutfit();

  const rateLimitedFor = useCountdown(rateLimitedUntil);
  const profileComplete = isStyleProfileComplete(toStyleProfileRow(profile));
  const result = analyse.data ?? null;

  // Read on mount, never prompt on mount. The rationale screen owns the prompt,
  // so a member sees why the camera is wanted before the OS asks (§10).
  useEffect(() => {
    let active = true;
    void camera
      .getPermission()
      .then((status) => active && setPermission(status))
      .catch(() => active && setPermission("blocked"));
    return () => {
      active = false;
    };
  }, []);

  /**
   * Hardware back. A good capture is the expensive thing on this screen — she
   * framed it, and on Android the back gesture is one thumb-flick away — so
   * leaving with one in hand is confirmed. Everything else closes immediately.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (photo && !result) {
        setDiscardOpen(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [photo, result]);

  const blockedMessage = !profileComplete
    ? "Complete your Style Profile so Mila can read this against your season."
    : !online
      ? "Mila needs a connection to read this outfit."
      : rateLimitedFor > 0
        ? formatRetryAfter(rateLimitedFor)
        : null;

  /**
   * Every analysis failure lands here. `kind` decides the response, so a server
   * code that is not yet handled cannot silently become a blank screen — and
   * `INSUFFICIENT_CREDITS` cannot fall into the generic handler, which is the
   * one thing §7 forbids.
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
      // The root gate owns the redirect; re-reading the profile is what makes
      // it re-decide. One place decides where the app is, always.
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    }
  }

  async function handleAllow() {
    setRequesting(true);
    try {
      setPermission(await camera.requestPermission());
    } catch {
      setPermission("blocked");
    } finally {
      setRequesting(false);
    }
  }

  async function withCapture(take: () => Promise<CapturedPhoto | null>) {
    setCapturing(true);
    setCaptureError(null);
    try {
      const next = await take();
      // A cancelled picker is not a failure — she simply changed her mind.
      if (next) {
        setPhoto(next);
        analyse.reset();
        haptics.selection();
      }
    } catch {
      setCaptureError("That photo didn't come through. Try again.");
    } finally {
      setCapturing(false);
    }
  }

  function handleAnalyse() {
    if (!photo || blockedMessage) return;

    analyse.mutate(photo, {
      onSuccess: (next) => {
        haptics.success();
        AccessibilityInfo.announceForAccessibility(
          `Analysis ready. ${next.analysis.overall_score} out of 100.`,
        );
      },
      onError: handleFailure,
    });
  }

  function requestClose() {
    if (photo && !result) {
      setDiscardOpen(true);
      return;
    }
    router.back();
  }

  function startOver() {
    setPhoto(null);
    setCaptureError(null);
    analyse.reset();
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      {analyse.isPending ? <KeepAwake /> : null}

      <View className="flex-row items-center gap-md px-lg py-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Lens"
          onPress={requestClose}
          style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
          className="h-tap w-tap items-center justify-center"
        >
          <Icon name="close" size="md" color="ink" />
        </Pressable>
        <Text accessibilityRole="header" className="font-display text-h3 text-ink">
          Lens
        </Text>
      </View>

      {permission === null ? (
        // Deliberately blank: this resolves in a frame or two, and a skeleton
        // that flashes for 30ms is noise rather than reassurance.
        <View className="flex-1" />
      ) : permission !== "granted" ? (
        <CameraPermissionPrompt
          status={permission}
          requesting={requesting}
          onAllow={() => void handleAllow()}
          onOpenSettings={() => void camera.openSettings()}
        />
      ) : result && photo ? (
        <Screen scroll edges={{ top: false, bottom: true }}>
          <View className="gap-xl py-lg">
            {/* The local capture, not the storage URL: it is the same frame and
                it is already on the device, so the result renders without a
                round trip. */}
            <ResultImage uri={photo.uri} />
            <AnalysisResultCard analysis={result.analysis} />
            <View className="gap-md">
              <Button
                label="View in History"
                onPress={() => router.replace(`/look/${result.outfitId}`)}
              />
              <Button label="Analyse another" variant="secondary" onPress={startOver} />
            </View>
          </View>
        </Screen>
      ) : analyse.isPending && photo ? (
        <Screen scroll edges={{ top: false, bottom: true }}>
          <View className="gap-xl py-lg">
            <ResultImage uri={photo.uri} />
            <AnalysisSkeleton />
          </View>
        </Screen>
      ) : photo ? (
        <CapturedPreview
          photo={photo}
          error={analyse.isError ? resolveApiFailure(analyse.error).message : null}
          busy={analyse.isPending}
          blockedMessage={blockedMessage}
          onRetake={startOver}
          onAnalyse={handleAnalyse}
        />
      ) : (
        <View className="flex-1" style={{ paddingBottom: insets.bottom }}>
          <View className="flex-1 overflow-hidden bg-surface-alt">
            <CameraPreview
              facing={facing}
              ref={handle}
              onReady={() => setPreviewReady(true)}
            />
          </View>

          {captureError ? (
            <View className="px-xl pt-md">
              <InlineError message={captureError} />
            </View>
          ) : null}

          <ShutterControls
            busy={capturing || !previewReady}
            onCapture={() =>
              void withCapture(async () => (await handle.current?.capture()) ?? null)
            }
            onPickFromLibrary={() => void withCapture(() => camera.pickFromLibrary())}
            onFlip={() => {
              // The other lens has to start streaming before it can be shot;
              // `onCameraReady` fires again and re-enables the shutter. Without
              // this, a tap during the switch throws and reads as a failure.
              setPreviewReady(false);
              setFacing((current) => (current === "back" ? "front" : "back"));
            }}
          />
        </View>
      )}

      <ConfirmSheet
        visible={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard this photo?"
        message="You'll need to take it again. Nothing has been analysed yet, so no credit has been used."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setDiscardOpen(false);
          router.back();
        }}
      />

      <PaywallSheet
        visible={paywallOpen}
        onClose={() => {
          setPaywallOpen(false);
          // Clear the failed mutation with the sheet, or the review step stays
          // in its error state behind a paywall she has already dismissed.
          if (analyse.isError) analyse.reset();
        }}
      />
    </View>
  );
}

/** The analysed frame, at the §11 card ratio. */
function ResultImage({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      // Case 1 of the StyleSheet exceptions: expo-image takes a style object.
      style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.card }}
      contentFit="cover"
      transition={200}
      accessibilityLabel="The outfit Mila analysed"
    />
  );
}
