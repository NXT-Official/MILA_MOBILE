import { useState } from "react";
import { Text, View } from "react-native";

import { Divider } from "@/components/ui/Divider";
import { generateDailyPalette } from "@/lib/color-analysis/paletteGenerator";
import type { SeasonId } from "@/lib/color-analysis/types";

/**
 * Three colours to build today around.
 *
 * Every swatch is named. The Colour-Is-Content rule is at its strictest here
 * (§11): the hex *is* the data, so a member who cannot separate the three
 * squares still reads "Sage Mist, Bone Ecru, Soft Coral" and loses nothing.
 *
 * Generated once per mount rather than per render — `generateDailyPalette` is
 * random, and a palette that reshuffles when an unrelated query settles is not
 * a daily palette.
 */
export function DailyPaletteStrip({ seasonId }: { seasonId: SeasonId }) {
  const [palette] = useState(() => generateDailyPalette(seasonId));

  const swatches = [
    { name: palette.baseColor, hex: palette.baseHex },
    { name: palette.statementColor, hex: palette.statementHex },
    { name: palette.accentColor, hex: palette.accentHex },
  ];

  return (
    <View className="gap-lg">
      <View className="flex-row items-center gap-md">
        <Divider className="flex-1" />
        <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
          Today&apos;s palette
        </Text>
        <Divider className="flex-1" />
      </View>

      <View className="flex-row gap-md">
        {swatches.map((swatch) => (
          <View key={swatch.hex} className="flex-1 gap-sm">
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              // The swatch colour is member data, not a theme token — it cannot
              // come from a class. Case 1 of the StyleSheet exceptions.
              style={{ backgroundColor: swatch.hex }}
              className="h-16 w-full rounded-panel border border-border dark:border-border/12"
            />
            <Text className="font-body text-micro text-body">{swatch.name}</Text>
          </View>
        ))}
      </View>

      <Text className="font-body text-sm text-body">{palette.insight}</Text>
    </View>
  );
}
