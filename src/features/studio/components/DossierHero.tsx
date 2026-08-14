import { Text, View } from "react-native";

import { SeasonTag } from "@/components/ui/SeasonTag";
import type { DetailedColorProfile as StudioDossier } from "@/constants/style-profile";

/**
 * The top of Studio: who she is, in colour.
 *
 * Every swatch is named. The Colour-Is-Content rule is at its strictest here
 * (§11) — the hexes *are* the dossier, so a member who cannot separate them
 * still reads the palette as a list of names and loses nothing.
 */
export function DossierHero({ dossier }: { dossier: StudioDossier }) {
  // The sub-season is the precise identity ("Soft Autumn"); the family is the
  // fallback for a legacy dossier that only ever stored the base.
  const seasonName = dossier.subSeason || dossier.season;
  const swatches = dossier.primarySwatches.slice(0, 6);

  return (
    <View className="gap-lg">
      <View className="gap-sm">
        <Text
          accessibilityRole="header"
          className="font-display text-h1 tracking-heading text-ink"
        >
          {seasonName}
        </Text>
        {swatches[0] ? <SeasonTag season={seasonName} hex={swatches[0].hex} /> : null}
      </View>

      {dossier.stylistNote ? (
        <Text className="font-body text-base text-body">{dossier.stylistNote}</Text>
      ) : null}

      <View className="flex-row flex-wrap gap-md">
        {swatches.map((swatch) => (
          <View key={`${swatch.hex}-${swatch.name}`} className="w-tile gap-sm">
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              // Case 1 of the StyleSheet exceptions: the colour is member data.
              style={{ backgroundColor: swatch.hex }}
              className="h-tile w-full rounded-panel border border-border dark:border-border/12"
            />
            <Text numberOfLines={2} className="font-body text-micro text-body">
              {swatch.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
