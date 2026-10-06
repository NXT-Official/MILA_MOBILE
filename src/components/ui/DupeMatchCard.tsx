import { Linking, Pressable, Text, View } from "react-native";

import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { GarmentBadge } from "@/components/ui/GarmentBadge";
import { Icon } from "@/components/ui/Icon";
import { SaveFailedNotice, SaveProductButton } from "@/components/ui/SaveProductButton";
import { garmentFor } from "@/lib/garment-label";
import type { DupeMatch } from "@/services/api/items";
import type { SaveSource } from "@/services/supabase/saved-products";
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
 *
 * The garment badge and the "{Label}: {title}" line say which piece of the
 * photographed outfit this product is. The save bookmark sits over the photo's
 * top-right corner as a **sibling** of the card's link, never inside it: a
 * button nested in a link is two controls fighting for one tap, and on the web
 * it is invalid markup.
 *
 * `saveSource` says where the match was found: "dupe" (Lens Dupe Hunter, the
 * default) or "post_item" (a feed post's garment, with its `postItemId`).
 */
export function DupeMatchCard({
  match,
  saveSource = "dupe",
  postItemId,
}: {
  match: DupeMatch;
  saveSource?: SaveSource;
  postItemId?: string;
}) {
  const verified = match.verification_status === "verified" && match.last_verified_at;
  const hasRating = match.rating != null || match.units_sold != null;
  const garment = garmentFor(match.category, match.title);

  return (
    <View className="flex-1">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${garment.label}: ${match.title}, ${formatPrice(match.price, match.currency)}`}
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
          <GarmentBadge garment={garment} />
        </View>

        <View className="gap-xs">
          <Text numberOfLines={2} className="font-body-medium text-sm text-ink">
            {`${garment.label}: ${match.title}`}
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

      {/* Outside the link, so the words are not swallowed into its name. */}
      <SaveFailedNotice productId={match.id} />

      <View className="absolute right-sm top-sm">
        <SaveProductButton product={match} source={saveSource} postItemId={postItemId} />
      </View>
    </View>
  );
}
