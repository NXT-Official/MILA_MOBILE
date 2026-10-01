import { Image } from "expo-image";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { radii } from "@/theme/tokens";

export type LookVisualState = "loading" | "ready" | "failed";

/**
 * The media slot both visuals share — the web's `outfit-visual.tsx`, kept as
 * one component for the same reason it does: the style sheet and the portrait
 * preview differ only in copy and aspect ratio.
 *
 * `failed` is the partial-success state (§8): the written look is on screen
 * above, so this offers a retry for the *visual alone* without implying the
 * composition is gone.
 */
export function LookVisual({
  state,
  imageDataUri,
  headline,
  label,
  loadingTitle = "Visualizing your look…",
  loadingHint = "Creating your personalized outfit visual.",
  aspect = "portrait",
  failedMessage = "The outfit is ready, but the visual could not be generated.",
  onRetry,
  retryDisabled,
  onDownload,
  onRendered,
}: {
  state: LookVisualState;
  imageDataUri: string | null;
  headline: string;
  /** Also the caption under a ready image, verbatim from the web. */
  label: string;
  loadingTitle?: string;
  loadingHint?: string;
  aspect?: "video" | "portrait";
  /** The slot's failure copy; the style sheet names itself, the preview does not. */
  failedMessage?: string;
  onRetry: () => void;
  retryDisabled?: boolean;
  onDownload: () => void;
  /**
   * The image is on screen (or has definitively failed to decode) — the moment
   * the CTA may unlock. `onDisplay` is the paint; `onError` releases the same
   * latch because an image that will never appear must not hold the button
   * hostage forever.
   */
  onRendered?: () => void;
}) {
  const frame =
    aspect === "video"
      ? "aspect-video w-full items-center justify-center gap-md rounded-card border border-border bg-surface px-xl dark:border-border/12"
      : "aspect-[3/4] w-full items-center justify-center gap-md rounded-card border border-border bg-surface px-xl dark:border-border/12";

  if (state === "loading") {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        accessibilityLabel={loadingTitle}
      >
        <View className={frame}>
          <Skeleton className="absolute inset-0 rounded-card" />
          <ActivityIndicator />
          <Text className="font-display text-lg text-ink text-center">{loadingTitle}</Text>
          <Text className="font-body text-sm text-body text-center">{loadingHint}</Text>
        </View>
      </View>
    );
  }

  if (state === "ready" && imageDataUri) {
    return (
      <View className="gap-sm">
        <View className="relative">
          <Image
            source={{ uri: imageDataUri }}
            // Case 1 of the StyleSheet exceptions: expo-image takes a style
            // object, and the radius comes from the token scale.
            style={{
              width: "100%",
              aspectRatio: aspect === "video" ? 16 / 9 : 3 / 4,
              borderRadius: radii.card,
            }}
            contentFit="contain"
            transition={200}
            accessibilityLabel={`${label} of ${headline}`}
            onDisplay={onRendered}
            onError={onRendered}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Download image"
            onPress={onDownload}
            hitSlop={8}
            className="absolute right-md top-md min-h-tap min-w-tap items-center justify-center rounded-pill border border-border bg-canvas/90 dark:border-border/12"
          >
            <Icon name="download" size="sm" color="ink" />
          </Pressable>
        </View>
        <Text className="font-body text-micro tracking-label-xwide uppercase text-muted">
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View className={frame}>
      <Icon name="imageOff" size="md" color="muted" />
      <Text className="font-body text-sm text-body text-center">{failedMessage}</Text>
      <Button label="Retry visual" variant="secondary" disabled={retryDisabled} onPress={onRetry} />
    </View>
  );
}
