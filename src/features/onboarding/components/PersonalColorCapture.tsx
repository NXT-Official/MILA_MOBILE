import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { KeepAwake } from "@/components/feedback/KeepAwake";
import { PaywallSheet } from "@/components/feedback/PaywallSheet";
import { CameraPermissionPrompt } from "@/components/media/CameraPermissionPrompt";
import { ShutterControls } from "@/components/media/ShutterControls";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { queryKeys } from "@/constants/query-keys";
import { useHaptics } from "@/hooks/use-haptics";
import { resolvePersonalColorFailure, type PersonalColorFailure } from "@/lib/personal-color-copy";
import { analyzePersonalColor } from "@/services/api/analysis";
import { resolveApiFailure } from "@/services/api/client";
import {
  CameraPreview,
  camera,
  type CameraHandle,
  type CapturedPhoto,
  type PermissionStatus,
} from "@/services/camera";
import { useAuthStore } from "@/stores/auth-store";
import type { StudioColorProfile } from "@/types/models";
import { cn } from "@/utils/cn";

type Stage = "briefing" | "camera" | "reading" | "failed";

/**
 * The live colour read, presented full-screen — the native twin of the web's
 * `VisualDiagnosticViewfinder`. It owns the whole arc: the light briefing, the
 * camera, the request, and every failure the endpoint can answer with.
 *
 * The photo is read straight off the capture as base64 and sent; it never
 * touches storage, and while the founding read is free it never touches a
 * credit either (the server decides — see `personal-color-analysis.ts`).
 *
 * A failed read always leaves the manual path one tap away: "I know my season"
 * is not snuffed out by a bad connection, so the step can never dead-end.
 */
export function PersonalColorCapture({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (profile: StudioColorProfile) => void;
}) {
  const [stage, setStage] = useState<Stage>("briefing");
  const [lightingConfirmed, setLightingConfirmed] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [failure, setFailure] = useState<PersonalColorFailure | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const handle = useRef<CameraHandle>(null);
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const haptics = useHaptics();

  // Read on mount, never prompt: the briefing owns the request, so the system
  // dialog arrives after the member has read why (§10).
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

  function fail(next: PersonalColorFailure) {
    setFailure(next);
    setStage("failed");
  }

  function handleReadFailure(rawError: string | undefined) {
    const next = resolvePersonalColorFailure(rawError);
    if (next.kind === "paywall") {
      setPaywallOpen(true);
      return;
    }
    fail(next);
  }

  async function runRead(photo: CapturedPhoto) {
    setStage("reading");
    AccessibilityInfo.announceForAccessibility("Reading your colouring.");
    try {
      const imageBase64 = await new File(photo.uri).base64();
      const result = await analyzePersonalColor({ imageBase64 });
      if (!result.success) {
        handleReadFailure(result.error);
        return;
      }
      haptics.success();
      AccessibilityInfo.announceForAccessibility("Colour reading ready.");
      onComplete(result.profile);
    } catch (error) {
      // Thrown failures are transport or auth, not read failures — the shared
      // resolver owns their copy. Auth/suspended reroute the whole app one
      // render later; the message here only has to hold the ground until then.
      const apiFailure = resolveApiFailure(error);
      if (apiFailure.kind === "paywall") {
        setPaywallOpen(true);
        return;
      }
      fail({
        kind: apiFailure.kind === "rate-limited" ? "rate-limited" : "retry",
        message: apiFailure.message,
      });
    } finally {
      // A re-read charges a credit (refunded when the read fails) — resync.
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
    }
  }

  async function withCapture(take: () => Promise<CapturedPhoto | null>) {
    setCapturing(true);
    setCaptureError(null);
    try {
      const photo = await take();
      // A cancelled picker is not a failure — she simply changed her mind.
      if (photo) {
        haptics.selection();
        await runRead(photo);
      }
    } catch {
      setCaptureError("That photo didn't come through. Try again.");
    } finally {
      setCapturing(false);
    }
  }

  function retry() {
    setFailure(null);
    setCaptureError(null);
    setPreviewReady(false);
    setStage("camera");
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View className="flex-1 bg-canvas">
        {stage === "reading" ? <KeepAwake /> : null}

        {stage === "briefing" ? (
          <View className="flex-1">
            <View className="flex-row items-center justify-between px-lg py-sm">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close colour reading"
                onPress={onClose}
                className="active:opacity-60 h-tap w-tap items-center justify-center"
              >
                <Icon name="close" size="md" color="ink" />
              </Pressable>
              <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
                Find your light
              </Text>
              <View className="h-tap w-tap" />
            </View>

            <ScrollView className="flex-1 px-xl" contentContainerStyle={{ paddingBottom: 40 }}>
              <View className="gap-lg py-xl">
                <Text
                  accessibilityRole="header"
                  className="text-center font-display text-h2 text-ink"
                >
                  Step into natural, indirect daylight
                </Text>
                <Text className="text-center font-body text-sm text-body">
                  Before I open the camera, find a window with soft, indirect daylight — no direct
                  sun, no overhead yellow bulbs. That&apos;s how I see your true tones.
                </Text>
                <Text className="text-center font-body text-sm text-body">
                  This scan also lets Mila show your outfits on your real photo, not just a model.
                </Text>

                <View className="gap-md">
                  <BriefingRule
                    title="Face the window"
                    body="Natural daylight from the front. No backlight, no direct sun."
                  />
                  <BriefingRule
                    title="Switch off yellow bulbs"
                    body="Warm overhead lamps throw the read off."
                  />
                  <BriefingRule
                    title="Wear something neutral"
                    body="Saturated tops can cast colour onto your skin."
                  />
                </View>

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: lightingConfirmed }}
                  onPress={() => setLightingConfirmed((current) => !current)}
                  className={cn(
                    "active:opacity-90 flex-row items-start gap-md rounded-panel border p-lg",
                    lightingConfirmed ? "border-ink bg-accent-soft" : "border-border bg-surface",
                  )}
                >
                  <Text className="flex-1 font-body text-sm text-body">
                    I&apos;m in soft, indirect natural daylight. Let&apos;s go.
                  </Text>
                  {lightingConfirmed ? <Icon name="check" size="sm" color="ink" /> : null}
                </Pressable>

                <Button
                  label="Open the camera"
                  disabled={!lightingConfirmed}
                  onPress={() => setStage("camera")}
                  className="mt-sm"
                />
                <Text className="text-center font-body text-sm text-muted">
                  Your camera stays off until you&apos;re ready.
                </Text>
              </View>
            </ScrollView>
          </View>
        ) : stage === "camera" ? (
          <View className="flex-1">
            <View className="flex-row items-center justify-between px-lg py-sm">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close colour reading"
                onPress={onClose}
                className="active:opacity-60 h-tap w-tap items-center justify-center"
              >
                <Icon name="close" size="md" color="ink" />
              </Pressable>
              <Text accessibilityRole="header" className="font-display text-h3 text-ink">
                Studio camera
              </Text>
              <View className="h-tap w-tap" />
            </View>

            {permission === null ? (
              <View className="flex-1" />
            ) : permission !== "granted" ? (
              <CameraPermissionPrompt
                status={permission}
                requesting={requesting}
                onAllow={() => void handleAllow()}
                onOpenSettings={() => void camera.openSettings()}
                description={
                  permission === "blocked"
                    ? "Turn the camera on for Mila in your device settings, then come back to read your colouring."
                    : "One photo of your face in soft daylight, read for your true tones. Nothing leaves your account."
                }
              />
            ) : (
              <>
                <View className="flex-1 bg-black">
                  <CameraPreview facing="front" ref={handle} onReady={() => setPreviewReady(true)} />
                </View>
                <View className="gap-md bg-canvas px-lg pb-lg">
                  <Text className="text-center font-body text-sm text-body">
                    Face the window. Soft daylight, no backlight.
                  </Text>
                  {captureError ? <InlineError message={captureError} /> : null}
                  <ShutterControls
                    busy={capturing || !previewReady}
                    onCapture={() =>
                      void withCapture(async () => (await handle.current?.capture()) ?? null)
                    }
                    onPickFromLibrary={() => void withCapture(() => camera.pickFromLibrary())}
                  />
                </View>
              </>
            )}
          </View>
        ) : stage === "reading" ? (
          <View className="flex-1 items-center justify-center px-xl">
            <LoadingState label="Reading your true tones…" lines={2} />
          </View>
        ) : (
          <View className="flex-1 items-center justify-center gap-lg px-xl">
            <Icon name="alert" size="xl" color="muted" />
            <Text accessibilityRole="header" className="text-center font-display text-h2 text-ink">
              That reading didn&apos;t land
            </Text>
            <InlineError message={failure?.message ?? "Please try again."} />
            <Button label="Try again" onPress={retry} className="w-full" />
            <Button
              label="Choose my season instead"
              variant="secondary"
              onPress={onClose}
              className="w-full"
            />
          </View>
        )}

        <PaywallSheet
          visible={paywallOpen}
          onClose={() => {
            setPaywallOpen(false);
            fail({
              kind: "paywall",
              message: "You're out of studio credits for today. They reset tomorrow.",
            });
          }}
        />
      </View>
    </Modal>
  );
}

/** One light-briefing rule — title plus the why, same as the web's briefing. */
function BriefingRule({ title, body }: { title: string; body: string }) {
  return (
    <View className="gap-xs rounded-panel border border-border p-lg">
      <Text className="font-body-medium text-base text-ink">{title}</Text>
      <Text className="font-body text-sm text-body">{body}</Text>
    </View>
  );
}
