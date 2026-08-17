import { Image } from "expo-image";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { radii } from "@/theme/tokens";

/**
 * `image-failed` is the partial-success state and the reason this is a union
 * rather than a `loading`/`error` pair: the written look succeeded and is on
 * screen above, so this slot must offer a retry for the *visual alone* without
 * implying the composition is gone (§8).
 */
export type OutfitVisualState =
  | { kind: "empty" }
  | { kind: "composing" }
  | { kind: "rendering" }
  | { kind: "failed"; message: string }
  | { kind: "image-failed" }
  | { kind: "ready"; imageUrl: string };

const PANEL =
  "aspect-[3/4] w-full items-center justify-center gap-md rounded-card border border-border bg-surface px-xl dark:border-border/12";

/**
 * The 3:4 slot the look lands in. Aspect ratio, never fixed pixels — it has to
 * hold at 360dp and on a foldable alike.
 */
export function OutfitVisual({
  state,
  onRetry,
  onRetryImage,
}: {
  state: OutfitVisualState;
  onRetry: () => void;
  onRetryImage: () => void;
}) {
  if (state.kind === "composing" || state.kind === "rendering") {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        accessibilityLabel={
          state.kind === "composing" ? "Composing your look" : "Rendering the visual"
        }
      >
        <Skeleton className="aspect-[3/4] w-full rounded-card" />
      </View>
    );
  }

  if (state.kind === "failed") {
    return (
      <View className={PANEL}>
        <Icon name="alert" size="lg" color="muted" />
        <Text className="font-display text-h3 text-ink text-center">
          That didn&apos;t come together
        </Text>
        <Text className="font-body text-base text-body text-center">{state.message}</Text>
        <Button label="Try again" variant="secondary" onPress={onRetry} />
      </View>
    );
  }

  if (state.kind === "image-failed") {
    return (
      <View className={PANEL}>
        <Icon name="outfit" size="lg" color="muted" />
        {/* The §8 copy, verbatim. It says what survived before what did not,
            because the composition above is still the product. */}
        <Text className="font-body text-base text-body text-center">
          The outfit was created, but its visual could not be generated.
        </Text>
        <Button label="Try the visual again" variant="secondary" onPress={onRetryImage} />
      </View>
    );
  }

  if (state.kind === "ready") {
    return (
      <Image
        source={{ uri: state.imageUrl }}
        // Case 1 of the StyleSheet exceptions: expo-image takes a style object,
        // and the radius comes from the token scale rather than a literal.
        style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.card }}
        contentFit="cover"
        transition={200}
        accessibilityLabel="Today's look"
      />
    );
  }

  // The web's empty hero, verbatim: centred prose, no icon and no frame. A
  // framed 3:4 box here read as an image that had failed to load — there is no
  // visual yet, so there is nothing to draw a frame around. §10's icon-and-
  // action empty state governs a list with nothing in it, not a slot that has
  // not been asked to fill yet; the action is the CTA directly above.
  return (
    <View className="items-center gap-md py-lg">
      <Text
        accessibilityRole="header"
        className="font-display text-h2 tracking-heading text-ink text-center"
      >
        Set the mood. Mila will compose the rest.
      </Text>
      <Text className="font-body text-base text-body text-center">
        Each look is composed from first principles — tuned to your palette, body architecture, and
        the weather outside.
      </Text>
    </View>
  );
}
