import { Text, View } from "react-native";

import { SeasonTag } from "@/components/ui/SeasonTag";
import {
  SEASON_ONE_LINER,
  type DetailedColorProfile as StudioDossier,
} from "@/constants/style-profile";

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
  // Her own stylist note when the reading produced one; the season's one-liner
  // otherwise, so the hero never states a season and then says nothing about it.
  const summary = dossier.stylistNote || SEASON_ONE_LINER[dossier.season];

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

      {summary ? <Text className="font-body text-base text-body">{summary}</Text> : null}

      {/* The three readings the calibration produced. Read-only here: they are
          set on /dossier/color, not edited a second time from Studio. */}
      <View className="flex-row gap-sm">
        <Fact label="Undertone" value={dossier.toneType} />
        <Fact label="Lightness" value={dossier.brightness} />
        <Fact label="Contrast" value={dossier.contrastScale} />
      </View>

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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-xs rounded-panel border border-border bg-surface px-md py-md dark:border-border/12">
      <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
        {label}
      </Text>
      <Text className="font-body text-sm text-ink">{value}</Text>
    </View>
  );
}
