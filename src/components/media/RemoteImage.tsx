import { Image, type ImageContentFit } from "expo-image";
import { useRef, useState } from "react";
import { Text, View, type StyleProp, type ImageStyle } from "react-native";

import { Icon } from "@/components/ui/Icon";

/**
 * An image behind a **1-hour signed URL**.
 *
 * The `posts` bucket is private, so every feed image is a URL that stops working
 * partway through a long session. The recovery is not a retry of the same dead
 * link — it is refetching the query that minted it, which returns fresh URLs for
 * the whole page. That is what `onExpired` is for.
 *
 * The retry is fired **once per URL**. A signed URL that fails because the
 * object is genuinely gone would otherwise refetch, fail, refetch — a loop that
 * hammers the endpoint and shows the member a flickering placeholder.
 */
export function RemoteImage({
  uri,
  /**
   * Passed to `expo-image` so a recycled row drops the previous row's bitmap
   * instead of showing it under the new one. This is the difference between a
   * feed that scrolls and a feed that OOMs a cheap phone.
   */
  recyclingKey,
  contentFit = "cover",
  style,
  accessibilityLabel,
  onExpired,
}: {
  uri: string | null;
  recyclingKey: string;
  contentFit?: ImageContentFit;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel: string;
  /** Refetch the query that produced this URL. Called at most once per URL. */
  onExpired?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [seenUri, setSeenUri] = useState(uri);
  const retried = useRef<string | null>(null);

  // A new URL is a new chance: the parent refetched and handed down a fresh
  // signature, so the failure state has to clear or the placeholder is permanent.
  //
  // Adjusted during render rather than in an effect. React re-runs this
  // component immediately with the corrected state and commits nothing in
  // between — an effect would paint the stale placeholder for one frame first,
  // which is a visible flash on every refetch.
  if (seenUri !== uri) {
    setSeenUri(uri);
    setFailed(false);
  }

  if (!uri || failed) {
    return (
      <View
        style={style}
        className="items-center justify-center gap-sm bg-surface-alt"
        accessibilityLabel={`${accessibilityLabel} is unavailable`}
      >
        <Icon name="imageOff" size="md" color="muted" />
        <Text className="font-body text-micro text-muted">Image unavailable</Text>
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
      // Bounded on purpose. The default is unlimited, and 80 posts × 2 images of
      // full-bleed photography is exactly the shape that exhausts a 2 GB device.
      cachePolicy="memory-disk"
      accessibilityLabel={accessibilityLabel}
      onError={() => {
        // expo-image cannot report the HTTP status, so a 403 is indistinguishable
        // from a dead socket here. Refetching is the right answer to both: it
        // re-signs an expired URL and is harmless otherwise.
        if (onExpired && retried.current !== uri) {
          retried.current = uri;
          onExpired();
          return;
        }
        setFailed(true);
      }}
    />
  );
}
