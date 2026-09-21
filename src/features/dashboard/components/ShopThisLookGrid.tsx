import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import type { ShoppablePick } from "@/types/look";
import { formatPrice } from "@/utils/format-price";

/**
 * The picks the server hydrated from the catalogue — the web's
 * `shop-look-grid.tsx`. Every row here is a real product row: title, price,
 * link, and verification state come from the database, never from model text.
 *
 * The empty case is rendered, not hidden: `shoppable_picks: []` means the
 * catalogue matched nothing for this look, and saying so is more honest than a
 * section that silently vanishes.
 */
export function ShopThisLookGrid({ items }: { items: ShoppablePick[] }) {
  return (
    <View className="gap-lg">
      <Text className="font-body-semibold text-section tracking-section uppercase text-ink">
        Shop This Look
      </Text>

      {items.length === 0 ? (
        <Text className="font-body text-sm text-body">No verified matching item found.</Text>
      ) : (
        <View className="flex-row flex-wrap gap-md">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </View>
      )}
    </View>
  );
}

function ProductCard({ item }: { item: ShoppablePick }) {
  const verified = item.verification_status === "verified" && item.last_verified_at;

  return (
    <View className="w-[48%] overflow-hidden rounded-card border border-border bg-surface dark:border-border/12">
      <View className="aspect-square w-full bg-accent-soft/40">
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={item.title}
          />
        ) : (
          <View className="h-full w-full items-center justify-center gap-sm">
            <Icon name="imageOff" size="sm" color="muted" />
            <Text className="font-body text-micro tracking-label-xwide uppercase text-muted text-center">
              Image not available
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1 gap-xs p-md">
        <Text className="font-body text-micro tracking-label uppercase text-muted">
          {item.category}
        </Text>
        <Text className="font-display text-sm leading-snug text-ink" numberOfLines={2}>
          {item.title}
        </Text>
        <Text className="font-body-medium text-sm text-ink">
          {formatPrice(item.price, item.currency)}
        </Text>
        <Text className="font-body text-micro text-muted">
          {verified
            ? `Last checked ${new Date(item.last_verified_at as string).toLocaleDateString()}`
            : "Link not yet verified"}
        </Text>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Shop ${item.title}`}
          onPress={() => {
            // The web opens the affiliate link in a new tab with
            // `rel="noopener noreferrer sponsored"`; the in-app browser is the
            // mobile equivalent — it keeps the affiliate click attributed and
            // never navigates the app away.
            void WebBrowser.openBrowserAsync(item.affiliate_link);
          }}
          className="mt-sm min-h-tap flex-row items-center justify-center gap-sm rounded-pill bg-ink px-lg py-sm active:opacity-90"
        >
          <Text className="font-body-medium text-sm text-canvas">Shop</Text>
          <Icon name="external" size="xs" rawColor="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}
