import { Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { paletteInsight, paletteSwatches, paletteVibe } from "@/lib/saved-palette";
import type { SavedPalette } from "@/services/supabase/palettes";
import { relativeTime } from "@/utils/relative-time";

/**
 * One pinned palette.
 *
 * The swatches are decorative to a screen reader and the **names carry the
 * meaning** — the Colour-Is-Content rule in practice (§11). Each name sits
 * under its role and beside where to wear it, so "Base, Sage Mist, bottoms or a
 * jacket" reads as a usable instruction rather than three anonymous colours.
 */
export function PaletteCard({
  saved,
  onDelete,
  deleting,
}: {
  saved: SavedPalette;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const swatches = paletteSwatches(saved.palette);

  return (
    <View className="gap-md rounded-card border border-border bg-surface p-lg dark:border-border/12">
      <View className="flex-row items-center justify-between gap-md">
        <Badge label={paletteVibe(saved.palette)} variant="neutral" />
        <Text className="font-body text-micro text-muted">{relativeTime(saved.created_at)}</Text>
      </View>

      <View className="flex-row gap-md">
        {swatches.map((swatch) => (
          <View key={swatch.hex} className="flex-1 gap-sm">
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              // Case 1 of the StyleSheet exceptions: the colour is member data.
              style={{ backgroundColor: swatch.hex }}
              className="h-tile w-full rounded-panel border border-border dark:border-border/12"
            />
            <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
              {swatch.role}
            </Text>
            <Text numberOfLines={2} className="font-body text-micro text-body">
              {swatch.name}
            </Text>
            <Text className="font-body text-micro text-muted">{swatch.wear}</Text>
          </View>
        ))}
      </View>

      <Text className="font-body text-sm text-body">{paletteInsight(saved.palette)}</Text>

      {onDelete ? (
        <Button
          label="Remove this palette"
          variant="ghost"
          size="sm"
          loading={deleting}
          onPress={onDelete}
        />
      ) : null}
    </View>
  );
}
