import { Image } from "expo-image";
import { Text, View } from "react-native";

import { images } from "@/constants/images";

/**
 * Brand artwork, not an icon — the one carve-out §11 grants alongside the
 * Google mark. The mark carries its own palette (the colour-analysis motif) and
 * is never re-tinted to a theme token.
 */
export function Wordmark() {
  return (
    <View className="items-center gap-md" accessible accessibilityRole="header">
      <View className="flex-row items-center gap-md">
        <Image
          source={images.logo}
          style={{ width: 40, height: 40 }}
          contentFit="contain"
          accessibilityLabel="Mila"
        />
        <Text className="font-display text-h1 tracking-label uppercase text-ink">Mila</Text>
      </View>
      <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
        Personal AI Fashion Stylist
      </Text>
    </View>
  );
}
