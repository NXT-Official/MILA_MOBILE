import { Image, type ImageContentFit } from "expo-image";
import { useState } from "react";
import { View, type ImageStyle, type StyleProp } from "react-native";

import { Icon } from "@/components/ui/Icon";

/**
 * A public image that may simply not be there — a catalogue row with no
 * photograph, or a brand CDN that has moved one.
 *
 * Distinct from `RemoteImage` on purpose: nothing here expires, so there is no
 * query to refetch and no retry to spend. It fails once, quietly, and shows a
 * glyph. Used for affiliate product thumbnails in the similar-items grid.
 */
export function ImageWithFallback({
  uri,
  recyclingKey,
  contentFit = "cover",
  style,
  accessibilityLabel,
}: {
  uri: string | null;
  recyclingKey: string;
  contentFit?: ImageContentFit;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel: string;
}) {
  const [failed, setFailed] = useState(false);
  const [seenUri, setSeenUri] = useState(uri);

  // Adjusted during render, not in an effect — see `RemoteImage` for why.
  if (seenUri !== uri) {
    setSeenUri(uri);
    setFailed(false);
  }

  if (!uri || failed) {
    return (
      <View
        style={style}
        className="items-center justify-center bg-surface-alt"
        accessibilityLabel={`${accessibilityLabel} has no image`}
      >
        <Icon name="imageOff" size="sm" color="muted" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      // Case 1 of the StyleSheet exceptions: expo-image takes a style object.
      style={style}
      contentFit={contentFit}
      recyclingKey={recyclingKey}
      transition={150}
      cachePolicy="memory-disk"
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailed(true)}
    />
  );
}
