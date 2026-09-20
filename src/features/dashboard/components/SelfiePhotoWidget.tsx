import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { CameraPermissionPrompt } from "@/components/media/CameraPermissionPrompt";
import { RemoteImage } from "@/components/media/RemoteImage";
import { ShutterControls } from "@/components/media/ShutterControls";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import {
  camera,
  CameraPreview,
  type CameraHandle,
  type CapturedPhoto,
  type PermissionStatus,
} from "@/services/camera";
import { radii } from "@/theme/tokens";
import { errorMessage } from "@/utils/error-message";

import {
  useDeleteSelfiePhoto,
  useProfilePhotoUrl,
  useSaveSelfiePhoto,
} from "../hooks/use-selfie-photo";

/**
 * The same consent onboarding's colour scan and Style Profile can already
 * set (`profiles.photo_consent_at` + `profile_photo_path`) — surfaced here
 * too because it was previously discoverable only by digging into onboarding
 * or settings, not from where a member actually taps Create My Look. Saving
 * here writes the exact same columns, so the very next generation picks it up
 * with no separate step.
 *
 * Follows `TryOnScreen`'s camera pattern (permission read on open, not on
 * mount; rationale before the OS prompt; library fallback) but condensed into
 * an inline card rather than a full screen — this is a dashboard widget, not
 * a destination.
 */
export function SelfiePhotoWidget({ hasConsent }: { hasConsent: boolean }) {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const handle = useRef<CameraHandle>(null);

  const photoUrl = useProfilePhotoUrl(hasConsent && !open);
  const save = useSaveSelfiePhoto();
  const remove = useDeleteSelfiePhoto();

  // Read only once the card is open, and never prompt on it — same rationale
  // as §10: the OS dialog appears only after she has already asked for the
  // camera by tapping "Take a selfie".
  useEffect(() => {
    if (!open) return;
    let active = true;
    void camera
      .getPermission()
      .then((status) => active && setPermission(status))
      .catch(() => active && setPermission("blocked"));
    return () => {
      active = false;
    };
  }, [open]);

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
    setCaptureError(null);
    try {
      const next = await take();
      // A cancelled picker is not a failure — she simply changed her mind.
      if (next) {
        setPhoto(next);
        setCameraOpen(false);
      }
    } catch {
      setCaptureError("That photo didn't come through. Try again.");
    }
  }

  async function persist(uri: string) {
    setCaptureError(null);
    try {
      await save.mutateAsync(uri);
      reset();
    } catch (err) {
      setCaptureError(errorMessage(err, "Couldn't save that photo. Please try again."));
    }
  }

  function reset() {
    setOpen(false);
    setCameraOpen(false);
    setPreviewReady(false);
    setPhoto(null);
    setCaptureError(null);
  }

  if (!open) {
    if (hasConsent) {
      return (
        <View className="flex-row items-center gap-sm self-start rounded-pill border border-border bg-surface px-md py-xs dark:border-border/12">
          {photoUrl.data ? (
            <RemoteImage
              uri={photoUrl.data}
              recyclingKey="selfie-widget-thumb"
              style={{ width: 28, height: 28, borderRadius: 14 }}
              accessibilityLabel="Your selfie"
              onExpired={() => void photoUrl.refetch()}
            />
          ) : (
            <Icon name="check" size="sm" color="accent" />
          )}
          <Text className="font-body text-sm text-muted">Your selfie is on file</Text>
          <Pressable accessibilityRole="button" onPress={() => setOpen(true)} hitSlop={8}>
            <Text className="font-body-medium text-sm text-accent underline">Change</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove selfie"
            disabled={remove.isPending}
            onPress={() => remove.mutate()}
            hitSlop={8}
          >
            <Icon name="close" size="xs" color="muted" />
          </Pressable>
        </View>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-sm self-start rounded-pill border border-dashed border-border bg-surface px-md py-xs dark:border-border/12"
      >
        <Icon name="camera" size="xs" color="muted" />
        <Text className="font-body text-sm text-muted">
          Add your selfie — see your own face in every look
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="gap-md rounded-card border border-border bg-surface p-lg dark:border-border/12">
      <View className="flex-row items-center justify-between">
        <Text className="font-body-semibold text-sm text-ink">Add your selfie</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={reset}
          hitSlop={8}
        >
          <Icon name="close" size="sm" color="muted" />
        </Pressable>
      </View>

      <Text className="font-body text-micro text-muted">
        Private, deletable anytime. Mila composites your outfit onto this exact photo — your face,
        identity, and background are never altered by the generator.
      </Text>

      {cameraOpen && permission !== null && permission !== "granted" ? (
        <CameraPermissionPrompt
          status={permission}
          requesting={requesting}
          onAllow={() => void handleAllow()}
          onOpenSettings={() => void camera.openSettings()}
        />
      ) : cameraOpen ? (
        <>
          <View
            style={{ aspectRatio: 3 / 4, borderRadius: radii.card }}
            className="overflow-hidden border border-border bg-surface-alt dark:border-border/12"
          >
            <CameraPreview facing="front" ref={handle} onReady={() => setPreviewReady(true)} />
          </View>
          <ShutterControls
            busy={!previewReady}
            onCapture={() =>
              void withCapture(async () => (await handle.current?.capture()) ?? null)
            }
            onPickFromLibrary={() => void withCapture(() => camera.pickFromLibrary())}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setCameraOpen(false)} />
        </>
      ) : photo ? (
        <>
          <View
            style={{ aspectRatio: 3 / 4, borderRadius: radii.card }}
            className="overflow-hidden border border-border bg-surface-alt dark:border-border/12"
          >
            <Image
              source={{ uri: photo.uri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Your captured selfie"
            />
          </View>
          {captureError ? <InlineError message={captureError} /> : null}
          <Button
            label="Use this photo"
            loading={save.isPending}
            onPress={() => void persist(photo.uri)}
          />
          <Button label="Retake" variant="ghost" onPress={() => setPhoto(null)} />
        </>
      ) : (
        <>
          {captureError ? <InlineError message={captureError} /> : null}
          <Button
            label="Take a selfie"
            icon="camera"
            onPress={() => {
              setPreviewReady(false);
              setCameraOpen(true);
            }}
          />
          <Button
            label="Choose a photo"
            variant="secondary"
            icon="gallery"
            onPress={() => void withCapture(() => camera.pickFromLibrary())}
          />
        </>
      )}
    </View>
  );
}
