import { Image } from "expo-image";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, Text, View } from "react-native";

import { GarmentBadge } from "@/components/ui/GarmentBadge";
import { Icon } from "@/components/ui/Icon";
import { SaveFailedNotice, SaveProductButton } from "@/components/ui/SaveProductButton";
import { useSavedProducts } from "@/hooks/use-saved-products";
import { garmentFor } from "@/lib/garment-label";
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
  // The bookmark on each card fills, and this says where the piece went. Shown
  // only once saving is live, so it never leads to a "not yet" screen.
  const savedList = useSavedProducts();

  return (
    <View className="gap-lg">
      <View className="flex-row items-center justify-between gap-md">
        <Text className="font-body-semibold text-section tracking-section uppercase text-ink">
          Shop This Look
        </Text>
        {savedList.data?.status === "ok" ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Saved pieces"
            onPress={() => router.push("/saved")}
            className="min-h-tap flex-row items-center gap-xs active:opacity-80"
          >
            <Icon name="bookmarkCheck" size="xs" color="muted" />
            <Text className="font-body-medium text-sm text-body">Saved pieces</Text>
          </Pressable>
        ) : null}
      </View>

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
  // The photo shows a whole outfit; the badge and the line under it say which
  // piece of it this product is.
  const garment = garmentFor(item.category, item.title);

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
        <GarmentBadge garment={garment} />
        <View className="absolute right-sm top-sm">
          <SaveProductButton product={item} source="look" />
        </View>
      </View>

      <View className="flex-1 gap-xs p-md">
        <Text className="font-body text-micro tracking-label uppercase text-muted">
          {item.source === "similar" ? `Similar · ${item.category}` : item.category}
        </Text>
        <Text className="font-display text-sm leading-snug text-ink" numberOfLines={2}>
          {`${garment.label}: ${item.title}`}
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
          <Text className="font-body-medium text-sm text-on-ink">Shop</Text>
          <Icon name="external" size="xs" color="onInk" />
        </Pressable>

        <SaveFailedNotice productId={item.id} />
      </View>
    </View>
  );
}
