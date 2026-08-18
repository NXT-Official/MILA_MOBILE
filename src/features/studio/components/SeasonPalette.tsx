import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { NAMED_PALETTE, type NamedSwatch, type Season } from "@/constants/style-profile";

import { SectionHeader } from "./SectionHeader";

/**
 * The season's named palette — the web dossier's "Your Palette" section (§3.8).
 *
 * Colour-Is-Content at its strictest: every swatch carries its name underneath,
 * and the band label ("Colours to avoid") carries the verdict, so nothing is
 * encoded in hue alone. Tapping a swatch opens where to wear it.
 */
export function SeasonPalette({
  season,
  fullPalette,
}: {
  season: Season;
  fullPalette: string[];
}) {
  const [selected, setSelected] = useState<NamedSwatch | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const palette = NAMED_PALETTE[season];

  return (
    <View className="gap-xl">
      <SectionHeader
        eyebrow="Explore"
        title="Your palette"
        subtitle="Tap any swatch for its name and where to wear it."
      />

      <Band label="Primary tones" swatches={palette.primary} onSelect={setSelected} />
      <Band label="Accents" swatches={palette.accents} onSelect={setSelected} />
      <Band label="Neutrals" swatches={palette.neutrals} onSelect={setSelected} />
      <Band label="Colours to avoid" swatches={palette.avoid} onSelect={setSelected} />

      {fullPalette.length > 0 ? (
        <View className="gap-md">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: archiveOpen }}
            accessibilityLabel="Reference archive, full master palette"
            onPress={() => setArchiveOpen((open) => !open)}
            className="active:opacity-80 min-h-tap flex-row items-center gap-md rounded-panel border border-border bg-surface px-lg py-md dark:border-border/12"
          >
            <View className="flex-1 gap-xs">
              <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
                Reference archive
              </Text>
              <Text className="font-body text-base text-ink">Full master palette</Text>
            </View>
            <Icon name={archiveOpen ? "chevronDown" : "chevronRight"} size="sm" color="muted" />
          </Pressable>

          {archiveOpen ? (
            <View className="gap-md rounded-card border border-border bg-surface p-lg dark:border-border/12">
              <Text className="font-body text-sm text-body">
                Your full {fullPalette.length}-colour master palette, for shopping references and
                mood boards.
              </Text>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="flex-row flex-wrap gap-xs"
              >
                {fullPalette.map((hex, index) => (
                  <View
                    key={`${hex}-${index}`}
                    // Case 1 of the StyleSheet exceptions: the colour is member data.
                    style={{ backgroundColor: hex }}
                    className="h-xl w-xl rounded-control border border-border dark:border-border/12"
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <Sheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        height="45%"
      >
        {selected ? (
          <View className="gap-lg">
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              // Case 1 of the StyleSheet exceptions: the colour is member data.
              style={{ backgroundColor: selected.hex }}
              className="h-3xl w-full rounded-card border border-border dark:border-border/12"
            />
            <Text className="font-body text-base text-body">{selected.tip}</Text>
            <View className="gap-xs">
              <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
                Wear it in
              </Text>
              <Text className="font-body text-base text-ink">{selected.use}</Text>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function Band({
  label,
  swatches,
  onSelect,
}: {
  label: string;
  swatches: NamedSwatch[];
  onSelect: (swatch: NamedSwatch) => void;
}) {
  return (
    <View className="gap-md">
      <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-md">
        {swatches.map((swatch) => (
          <Pressable
            key={`${swatch.hex}-${swatch.name}`}
            accessibilityRole="button"
            accessibilityLabel={`${swatch.name}, ${label}`}
            accessibilityHint="Opens where to wear it"
            onPress={() => onSelect(swatch)}
            className="active:opacity-85 w-tile gap-sm"
          >
            <View
              // Case 1 of the StyleSheet exceptions: the colour is member data.
              style={{ backgroundColor: swatch.hex }}
              className="h-tile w-full rounded-panel border border-border dark:border-border/12"
            />
            <Text numberOfLines={2} className="font-body text-micro text-body">
              {swatch.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
