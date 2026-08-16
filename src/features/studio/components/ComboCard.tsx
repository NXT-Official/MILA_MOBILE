import { Text, View } from "react-native";

import type { OutfitCombo } from "@/lib/style-profile/outfit-combos";

/**
 * One wearable trio from the season's palette.
 *
 * The swatch bar is decorative and hidden from assistive tech — the three names
 * underneath carry the same information, so a member who cannot separate the
 * hexes loses nothing (§10, no state in hue alone).
 */
export function ComboCard({ combo }: { combo: OutfitCombo }) {
  return (
    <View className="gap-md overflow-hidden rounded-card border border-border bg-surface p-lg dark:border-border/12">
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="h-tile flex-row overflow-hidden rounded-panel"
      >
        {combo.hexes.map((hex, index) => (
          <View
            key={`${combo.id}-${hex}-${index}`}
            // Case 1 of the StyleSheet exceptions: the colour is member data.
            style={{ backgroundColor: hex }}
            className="flex-1"
          />
        ))}
      </View>

      <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
        {combo.names.join(" · ")}
      </Text>
      <Text className="font-body text-sm text-body">{combo.note}</Text>
    </View>
  );
}
