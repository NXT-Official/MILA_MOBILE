import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Skeleton } from "@/components/ui/Skeleton";
import { paletteSwatches, paletteVibe } from "@/lib/saved-palette";
import type { SavedPalette } from "@/services/supabase/palettes";
import { spacing } from "@/theme/tokens";

/**
 * Saved palettes, as a horizontal strip into the full list (§3).
 *
 * A deliberate carousel, which §10 permits — the alternative is a grid that
 * pushes "Retake analysis" off the bottom of Studio. Each tile is one focus
 * stop announcing its three names, so the strip is one swipe for a screen
 * reader rather than nine.
 */
export function PaletteStrip({
  palettes,
  loading,
}: {
  palettes: SavedPalette[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <View className="flex-row gap-md">
        <Skeleton className="h-3xl w-tile rounded-panel" />
        <Skeleton className="h-3xl w-tile rounded-panel" />
      </View>
    );
  }

  if (palettes.length === 0) {
    return (
      <Text className="font-body text-sm text-body">
        Nothing pinned yet. Pin a daily palette from Home and it is kept here.
      </Text>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Third-party prop that takes a style object — case 1 of the exceptions.
      contentContainerStyle={{ gap: spacing.md }}
    >
      {palettes.map((saved) => {
        const swatches = paletteSwatches(saved.palette);

        return (
          <Pressable
            key={saved.id}
            accessibilityRole="button"
            accessibilityLabel={`${paletteVibe(saved.palette)} palette: ${swatches
              .map((s) => s.name)
              .join(", ")}`}
            onPress={() => router.push("/palettes")}
            className="active:opacity-85 gap-sm"
          >
            <View className="flex-row overflow-hidden rounded-panel border border-border dark:border-border/12">
              {swatches.map((swatch) => (
                <View
                  key={swatch.hex}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  // Case 1 of the StyleSheet exceptions: member data.
                  style={{ backgroundColor: swatch.hex }}
                  className="h-3xl w-lg"
                />
              ))}
            </View>
            <Text className="font-body text-micro text-muted">{paletteVibe(saved.palette)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
