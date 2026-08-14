import { Image } from "expo-image";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { radii } from "@/theme/tokens";

/**
 * The 3:4 slot the look lands in. Aspect ratio, never fixed pixels — it has to
 * hold at 360dp and on a foldable alike.
 *
 * Four states, all of them reachable: nothing yet, composing, failed, and the
 * image. The empty one is an invitation rather than a void — this is the
 * largest thing on the screen before she has generated anything, and a blank
 * grey rectangle would be the first impression of the product.
 */
export function OutfitVisual({
  imageUrl,
  loading,
  error,
  onRetry,
}: {
  imageUrl: string | null | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <Skeleton className="aspect-[3/4] w-full rounded-card" />
    );
  }

  if (error) {
    return (
      <View className="aspect-[3/4] w-full items-center justify-center gap-md rounded-card border border-border bg-surface px-xl dark:border-border/12">
        <Icon name="alert" size="lg" color="muted" />
        <Text className="font-display text-h3 text-ink text-center">
          That didn&apos;t come together
        </Text>
        <Text className="font-body text-base text-body text-center">
          Mila couldn&apos;t compose a look this time. Please try again.
        </Text>
        <Button label="Try again" variant="secondary" onPress={onRetry} />
      </View>
    );
  }

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        // Case 1 of the StyleSheet exceptions: expo-image takes a style object,
        // and the radius comes from the token scale rather than a literal.
        style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.card }}
        contentFit="cover"
        transition={200}
        accessibilityLabel="Today's look"
      />
    );
  }

  return (
    <View className="aspect-[3/4] w-full items-center justify-center gap-md rounded-card border border-border bg-surface px-xl dark:border-border/12">
      <Icon name="outfit" size="lg" color="muted" />
      <Text className="font-display text-h3 text-ink text-center">Today is unwritten</Text>
      <Text className="font-body text-base text-body text-center">
        Pick your occasion and Mila will put today&apos;s look together.
      </Text>
    </View>
  );
}
