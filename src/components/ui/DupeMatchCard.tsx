import { Linking, Pressable, Text, View } from "react-native";

import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import type { DupeMatch } from "@/services/api/items";
import { radii } from "@/theme/tokens";
import { formatPrice } from "@/utils/format-price";

/**
 * One catalogue match, as a tappable affiliate card.
 *
 * Shared rather than feature-local: the free similar-items lookup in the feed
 * and the paid Dupe Hunter in Lens render the same row, and a second copy is
 * how the two lists of the same product start looking different.
 */
export function DupeMatchCard({ match }: { match: DupeMatch }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${match.title}, ${formatPrice(match.price, match.currency)}`}
      onPress={() => void Linking.openURL(match.affiliate_link).catch(() => {})}
      className="active:opacity-90 flex-1 gap-sm"
    >
      <ImageWithFallback
        uri={match.image_url}
        recyclingKey={match.id}
        accessibilityLabel={match.title}
        style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.panel }}
      />
      <View className="gap-xs">
        <Text numberOfLines={2} className="font-body-medium text-sm text-ink">
          {match.title}
        </Text>
        <Text className="font-body text-micro text-muted">
          {formatPrice(match.price, match.currency)}
        </Text>
      </View>
    </Pressable>
  );
}
