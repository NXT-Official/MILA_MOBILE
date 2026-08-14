import { Pressable, Text, View } from "react-native";

import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { Icon } from "@/components/ui/Icon";
import type { ConciergeLook } from "@/stores/concierge-store";
import { radii, spacing } from "@/theme/tokens";

/**
 * The look this conversation is about, above the first message.
 *
 * The server re-reads the look scoped to the caller and attaches its image, so
 * this card is the member's confirmation of what Mila can see — not the
 * mechanism. Clearing it is one tap, because a question about a *different*
 * outfit answered against this one is worse than no anchor at all.
 */
export function AnchoredLookCard({
  look,
  onClear,
}: {
  look: ConciergeLook;
  onClear: () => void;
}) {
  return (
    <View className="flex-row items-center gap-md rounded-card border border-border bg-surface p-md dark:border-border/12">
      <ImageWithFallback
        uri={look.imageUrl}
        recyclingKey={look.id}
        accessibilityLabel={look.headline}
        // Case 1 of the StyleSheet exceptions. Sized from tokens at the §11 card
        // ratio rather than a pair of chosen pixel values.
        style={{ width: spacing["3xl"], aspectRatio: 3 / 4, borderRadius: radii.control }}
      />

      <View className="flex-1 gap-xs">
        <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
          About this look
        </Text>
        <Text numberOfLines={2} className="font-display text-base text-ink">
          {look.headline}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Stop asking about this look"
        onPress={onClear}
        style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
        className="h-tap w-tap items-center justify-center"
      >
        <Icon name="close" size="sm" color="muted" />
      </Pressable>
    </View>
  );
}
