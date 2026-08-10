import { Text, View } from "react-native";

import type { Swatch } from "@/constants/style-profile";

/**
 * The one place a colour is applied from data rather than from a token. These
 * hexes come out of the colour engine — they ARE the content, not chrome, so
 * they cannot be design tokens and cannot be Tailwind classes.
 *
 * Every swatch carries its name beneath it: the palette has to be readable to
 * a member who cannot distinguish two of the four.
 */
export function PaletteSwatches({ title, swatches }: { title: string; swatches: Swatch[] }) {
  if (swatches.length === 0) return null;

  return (
    <View className="gap-md">
      <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
        {title}
      </Text>
      {/* flex-1 rather than a fixed width: the palettes are four swatches wide
          and must stay one row on a 360dp phone and on a 480dp one. */}
      <View className="flex-row gap-md">
        {swatches.map((swatch) => (
          <View key={`${swatch.hex}-${swatch.name}`} className="flex-1 gap-xs">
            <View
              accessibilityLabel={swatch.name}
              // Data-driven colour — case outside the token system, see above.
              style={{ backgroundColor: swatch.hex }}
              className="h-tile w-full rounded-control border border-border dark:border-border/12"
            />
            <Text className="font-body text-label text-muted" numberOfLines={2}>
              {swatch.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
