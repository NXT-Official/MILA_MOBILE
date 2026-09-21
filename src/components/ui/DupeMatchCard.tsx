import { Linking, Pressable, Text, View } from "react-native";

import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { Icon } from "@/components/ui/Icon";
import type { DupeMatch } from "@/services/api/items";
import { radii } from "@/theme/tokens";
import { formatPrice } from "@/utils/format-price";

/**
 * One catalogue match, as a tappable affiliate card.
 *
 * Shared rather than feature-local: the free similar-items lookup in the feed
 * and the paid Dupe Hunter in Lens render the same row, and a second copy is
 * how the two lists of the same product start looking different.
 *
 * Every line below is a real catalogue column — the discount, the verified
 * seller, the rating, the shipping line and the link's verification state are
 * the fields the web's drawer renders, and none of them is model output.
 */
export function DupeMatchCard({ match }: { match: DupeMatch }) {
  const verified = match.verification_status === "verified" && match.last_verified_at;
  const hasRating = match.rating != null || match.units_sold != null;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${match.title}, ${formatPrice(match.price, match.currency)}`}
      onPress={() => void Linking.openURL(match.affiliate_link).catch(() => {})}
      className="active:opacity-90 flex-1 gap-sm"
    >
      <View>
        <ImageWithFallback
          uri={match.image_url}
          recyclingKey={match.id}
          accessibilityLabel={match.title}
          style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.panel }}
        />
        {match.discount_percent ? (
          <Text className="absolute left-sm top-sm rounded-pill bg-ink/90 px-sm py-xs font-body-medium text-label uppercase tracking-label text-on-ink">
            -{match.discount_percent}%
          </Text>
        ) : null}
      </View>

      <View className="gap-xs">
        <Text numberOfLines={2} className="font-body-medium text-sm text-ink">
          {match.title}
        </Text>

        <View className="flex-row items-center gap-sm">
          <Text className="font-body text-micro text-muted">
            {formatPrice(match.price, match.currency)}
          </Text>
          {match.is_verified_seller ? (
            <Icon name="verified" size="xs" color="accent" label="Verified seller" />
          ) : null}
        </View>

        {hasRating ? (
          <View className="flex-row items-center gap-xs">
            {match.rating != null ? (
              <>
                {/* Filled, like the web's — the one glyph the app fills. */}
                <Icon name="star" size="xs" color="muted" filled />
                <Text className="font-body text-micro text-muted">{match.rating.toFixed(1)}</Text>
              </>
            ) : null}
            {match.rating != null && match.units_sold != null ? (
              <Text className="font-body text-micro text-muted">·</Text>
            ) : null}
            {match.units_sold != null ? (
              <Text className="font-body text-micro text-muted">{match.units_sold} sold</Text>
            ) : null}
          </View>
        ) : null}

        {match.shipping_info ? (
          <View className="flex-row items-center gap-xs">
            <Icon name="truck" size="xs" color="muted" />
            <Text className="font-body text-micro text-muted">{match.shipping_info}</Text>
          </View>
        ) : null}

        {match.match_reasons[0] ? (
          <Text numberOfLines={2} className="font-body text-micro text-muted">
            {match.match_reasons[0]}
          </Text>
        ) : null}

        <Text className="font-body text-micro text-muted">
          {verified
            ? `Last checked ${new Date(match.last_verified_at as string).toLocaleDateString()}`
            : "Link not yet verified"}
        </Text>
      </View>
    </Pressable>
  );
}
