import { Image } from "expo-image";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import type { CapturedPhoto } from "@/services/camera";

/**
 * The review step: retake, or spend a credit.
 *
 * The capture stays on screen through a failure — a member who has framed a
 * good shot should never have to take it again because the upload timed out,
 * which is why `error` renders beside the same photo rather than replacing it.
 */
export function CapturedPreview({
  photo,
  error,
  busy,
  blockedMessage,
  onRetake,
  onAnalyse,
}: {
  photo: CapturedPhoto;
  /** Plain language, never a raw code. Null when the last attempt was clean. */
  error: string | null;
  busy: boolean;
  /** Offline or rate-limited: the action is disabled with the reason shown. */
  blockedMessage: string | null;
  onRetake: () => void;
  onAnalyse: () => void;
}) {
  return (
    <View className="flex-1">
      <Image
        source={{ uri: photo.uri }}
        // Case 1 of the StyleSheet exceptions: expo-image takes a style object.
        style={{ flex: 1 }}
        contentFit="contain"
        transition={120}
        accessibilityLabel="The outfit you just captured"
      />

      <View className="gap-md px-xl py-lg">
        {/* Blocked wins over the failure that caused it: a rate limit reports
            through both, and only this one counts down. */}
        {blockedMessage ? (
          <InlineError message={blockedMessage} />
        ) : error ? (
          <InlineError message={error} />
        ) : null}

        <Button
          label={error ? "Try again" : "Analyse this outfit"}
          loading={busy}
          disabled={Boolean(blockedMessage)}
          onPress={onAnalyse}
        />
        <Button label="Retake" variant="secondary" disabled={busy} onPress={onRetake} />
      </View>
    </View>
  );
}
