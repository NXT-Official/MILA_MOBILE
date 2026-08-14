import { Image } from "expo-image";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import type { CapturedPhoto } from "@/services/camera";
import { radii } from "@/theme/tokens";

import { CaptionInput } from "./CaptionInput";

/**
 * The review step: both frames, a caption, and one publish.
 *
 * Named a sheet in the phase plan, built as the third step of the full-screen
 * capture flow — a bottom sheet over a camera would put a keyboard, a scroll
 * view and a live preview on top of each other, and the composer needs the whole
 * screen anyway.
 *
 * Both retakes are offered: a member who nailed the outfit and blinked in the
 * portrait should not lose the outfit.
 */
export function PublishSheet({
  back,
  front,
  caption,
  onChangeCaption,
  publishing,
  error,
  blockedMessage,
  onRetakeBack,
  onRetakeFront,
  onPublish,
}: {
  back: CapturedPhoto;
  front: CapturedPhoto;
  caption: string;
  onChangeCaption: (next: string) => void;
  publishing: boolean;
  /** Plain language, never a raw code. */
  error: string | null;
  /** Offline: the action is disabled with the reason shown. */
  blockedMessage: string | null;
  onRetakeBack: () => void;
  onRetakeFront: () => void;
  onPublish: () => void;
}) {
  return (
    <View className="gap-xl py-lg">
      <View className="flex-row gap-md">
        <Frame uri={back.uri} label="Your outfit" onRetake={onRetakeBack} disabled={publishing} />
        <Frame uri={front.uri} label="Your portrait" onRetake={onRetakeFront} disabled={publishing} />
      </View>

      <CaptionInput value={caption} onChangeText={onChangeCaption} />

      {blockedMessage ? (
        <InlineError message={blockedMessage} />
      ) : error ? (
        <InlineError message={error} />
      ) : null}

      <View className="gap-md">
        <Button
          label={error ? "Try again" : "Publish"}
          loading={publishing}
          disabled={Boolean(blockedMessage)}
          onPress={onPublish}
        />
        <Text className="text-center font-body text-micro text-muted">
          Mila reads your outfit for pieces after publishing. That uses 1 credit, refunded if nothing
          is found.
        </Text>
      </View>
    </View>
  );
}

function Frame({
  uri,
  label,
  onRetake,
  disabled,
}: {
  uri: string;
  label: string;
  onRetake: () => void;
  disabled: boolean;
}) {
  return (
    <View className="flex-1 gap-sm">
      <Image
        source={{ uri }}
        // Case 1 of the StyleSheet exceptions: expo-image takes a style object.
        style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.panel }}
        contentFit="cover"
        transition={120}
        accessibilityLabel={label}
      />
      <Button label="Retake" variant="ghost" size="sm" disabled={disabled} onPress={onRetake} />
    </View>
  );
}
