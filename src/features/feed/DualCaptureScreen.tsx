import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeepAwake } from "@/components/feedback/KeepAwake";
import { Screen } from "@/components/layout/Screen";
import { CameraPermissionPrompt } from "@/components/media/CameraPermissionPrompt";
import { ShutterControls } from "@/components/media/ShutterControls";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { queryKeys } from "@/constants/query-keys";
import { useHaptics } from "@/hooks/use-haptics";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { resolveApiFailure } from "@/services/api/client";
import {
  CameraPreview,
  camera,
  type CameraHandle,
  type CapturedPhoto,
  type PermissionStatus,
} from "@/services/camera";
import { useAuthStore } from "@/stores/auth-store";
import { useCaptureStore } from "@/stores/capture-store";
import { useQueryClient } from "@tanstack/react-query";

import { CaptureStepPrompt } from "./components/CaptureStepPrompt";
import { PublishSheet } from "./components/PublishSheet";
import { TaggingSheet } from "./components/TaggingSheet";
import { usePublishPost } from "./hooks/use-publish-post";

/**
 * Publish an outfit of the day: rear full-body, front portrait, then review.
 *
 * The session lives in `capture-store` rather than local state, because it spans
 * three steps and has to survive the screen remounting between them — losing a
 * good full-body shot to a backgrounded app is not recoverable by retrying.
 *
 * Camera, permissions, and image format come from the Phase 05 adapter, so
 * nothing here knows which operating system it is on (§12).
 */
export function DualCaptureScreen() {
  const insets = useSafeAreaInsets();

  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  /** Set once a post lands, so the tagging sheet has something to tag. */
  const [published, setPublished] = useState<{ postId: string } | null>(null);

  const handle = useRef<CameraHandle>(null);

  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const { online } = useNetworkStatus();
  const haptics = useHaptics();
  const publish = usePublishPost();

  const step = useCaptureStore((s) => s.step);
  const back = useCaptureStore((s) => s.back);
  const front = useCaptureStore((s) => s.front);
  const caption = useCaptureStore((s) => s.caption);
  const setBack = useCaptureStore((s) => s.setBack);
  const setFront = useCaptureStore((s) => s.setFront);
  const setCaption = useCaptureStore((s) => s.setCaption);
  const goTo = useCaptureStore((s) => s.goTo);
  const reset = useCaptureStore((s) => s.reset);

  const hasCapture = Boolean(back || front);

  // Read on mount, never prompt on mount. The rationale screen owns the prompt.
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
   * Leaving with a capture in hand is confirmed; leaving empty-handed is not.
   * Cancelling discards the session, and nothing has been uploaded yet at any
   * point before publish — so there is no orphaned object to clean up.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (published) return false;
      if (hasCapture) {
        setDiscardOpen(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [hasCapture, published]);

  const blockedMessage = !online ? "Mila needs a connection to publish your look." : null;

  /**
   * Publishing itself is free — the two uploads and `/posts/create` cost
   * nothing — so there is no paywall path here. `/items/analyze` does charge,
   * but the hook swallows its failure by design: a post that published must
   * never report an error because its garment detection did not run.
   */
  function handleFailure(error: unknown) {
    const failure = resolveApiFailure(error);
    if (failure.kind === "suspended" || failure.kind === "auth") {
      // The root gate owns the redirect; re-reading the profile makes it decide.
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
      if (!next) return;
      haptics.selection();
      if (step === "back") setBack(next);
      else setFront(next);
    } catch {
      setCaptureError("That photo didn't come through. Try again.");
    } finally {
      setCapturing(false);
    }
  }

  function handlePublish() {
    if (!back || !front || blockedMessage) return;

    publish.mutate(
      { back, front, caption },
      {
        onSuccess: (result) => {
          haptics.success();
          AccessibilityInfo.announceForAccessibility("Your look is posted.");
          setPublished({ postId: result.postId });
          // Silent when nothing was detected: no sheet, no apology, no credit.
          // The tagging sheet only opens because `result.items` has something in it.
          if (result.items.length === 0) leave();
        },
        onError: handleFailure,
      },
    );
  }

  function leave() {
    reset();
    router.back();
  }

  function requestClose() {
    if (published) {
      leave();
      return;
    }
    if (hasCapture) {
      setDiscardOpen(true);
      return;
    }
    leave();
  }

  const capturingStep = step === "review" ? null : step;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      {publish.isPending ? <KeepAwake /> : null}

      <View className="flex-row items-center gap-md px-lg py-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={requestClose}
          style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
          className="h-tap w-tap items-center justify-center"
        >
          <Icon name="close" size="md" color="ink" />
        </Pressable>
        <Text accessibilityRole="header" className="font-display text-h3 text-ink">
          Your outfit today
        </Text>
      </View>

      {permission === null ? (
        <View className="flex-1" />
      ) : permission !== "granted" ? (
        <CameraPermissionPrompt
          status={permission}
          requesting={requesting}
          onAllow={() => void handleAllow()}
          onOpenSettings={() => void camera.openSettings()}
        />
      ) : capturingStep ? (
        <View className="flex-1" style={{ paddingBottom: insets.bottom }}>
          <CaptureStepPrompt step={capturingStep} />

          <View className="flex-1 overflow-hidden bg-surface-alt">
            <CameraPreview
              // Step 1 is a mirror selfie taken with the rear camera; step 2 is
              // the front portrait. The facing is the step, so there is no flip
              // to get wrong — the shutter bar hides it below.
              facing={capturingStep === "back" ? "back" : "front"}
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
            onCapture={() => void withCapture(async () => (await handle.current?.capture()) ?? null)}
            onPickFromLibrary={() => void withCapture(() => camera.pickFromLibrary())}
            // Flipping would defeat the step: each half of an OOTD is a specific
            // shot, and the prompt above already says which.
            onFlip={undefined}
          />
        </View>
      ) : back && front ? (
        <Screen scroll edges={{ top: false, bottom: true }}>
          <PublishSheet
            back={back}
            front={front}
            caption={caption}
            onChangeCaption={setCaption}
            publishing={publish.isPending}
            error={publish.isError ? resolveApiFailure(publish.error).message : null}
            blockedMessage={blockedMessage}
            onRetakeBack={() => {
              setPreviewReady(false);
              goTo("back");
            }}
            onRetakeFront={() => {
              setPreviewReady(false);
              goTo("front");
            }}
            onPublish={handlePublish}
          />
        </Screen>
      ) : (
        <View className="flex-1" />
      )}

      {published ? (
        <TaggingSheet
          postId={published.postId}
          items={publish.data?.items ?? []}
          visible
          onClose={leave}
        />
      ) : null}

      <ConfirmSheet
        visible={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard this look?"
        message="Your photographs are dropped and nothing is posted. None of it has been uploaded yet."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setDiscardOpen(false);
          leave();
        }}
      />
    </View>
  );
}
