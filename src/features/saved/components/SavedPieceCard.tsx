import * as WebBrowser from "expo-web-browser";
import { Text, View } from "react-native";

import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GarmentBadge } from "@/components/ui/GarmentBadge";
import type { Garment } from "@/lib/garment-label";
import type { SavedProduct, SavedProductAvailability } from "@/services/supabase/saved-products";
import { formatPrice } from "@/utils/format-price";

/** Why a piece cannot be bought right now, in words. Never colour alone (§10). */
const UNAVAILABLE_NOTE: Record<Exclude<SavedProductAvailability, "available">, string> = {
  gone: "No longer available",
  out_of_stock: "Out of stock right now",
  link_broken: "The shop link isn't working right now",
};

/** A shop link is opened only when it is a web address. */
function shopUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/**
 * One saved piece, drawn from the snapshot the server took when she saved it,
 * so it stays readable after the catalogue row is gone. Shop appears only when
 * the product can still be bought; Remove is always there.
 */
export function SavedPieceCard({
  item,
  garment,
  onRemove,
}: {
  item: SavedProduct;
  garment: Garment;
  onRemove: () => void;
}) {
  const { snapshot } = item;
  const title = snapshot.title ?? "Saved piece";
  const link = item.availability === "available" ? shopUrl(snapshot.product_url) : null;
  const note = item.availability === "available" ? null : UNAVAILABLE_NOTE[item.availability];

  return (
    <Card className="gap-lg">
      <View className="flex-row gap-lg">
        <View className="h-36 w-28 overflow-hidden rounded-control bg-surface-alt">
          <ImageWithFallback
            uri={snapshot.image_url}
            recyclingKey={item.id}
            accessibilityLabel={title}
            // Case 1 of the StyleSheet exceptions: expo-image takes a style object.
            style={{ width: "100%", height: "100%" }}
          />
          <GarmentBadge garment={garment} />
        </View>

        <View className="min-w-0 flex-1 gap-xs">
          <Text numberOfLines={3} className="font-display text-base text-ink">
            {`${garment.label}: ${title}`}
          </Text>
          {snapshot.brand ? (
            <Text numberOfLines={1} className="font-body text-sm text-muted">
              {snapshot.brand}
            </Text>
          ) : null}
          {snapshot.price != null && snapshot.currency ? (
            <Text className="font-body-medium text-sm text-ink">
              {formatPrice(snapshot.price, snapshot.currency)}
            </Text>
          ) : null}
          {note ? <Text className="font-body text-sm text-body">{note}</Text> : null}
        </View>
      </View>

      <View className="flex-row gap-md">
        {link ? (
          <Button
            label="Shop"
            accessibilityRole="link"
            accessibilityLabel={`Shop ${title}`}
            // The in-app browser, as on Shop This Look: it keeps the affiliate
            // click attributed and never navigates the app away.
            onPress={() => void WebBrowser.openBrowserAsync(link)}
            className="flex-1"
          />
        ) : null}
        <Button
          label="Remove"
          variant="secondary"
          accessibilityLabel={`Remove ${title}`}
          onPress={onRemove}
          className="flex-1"
        />
      </View>
    </Card>
  );
}
