import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { normalizeAnalysisResult } from "@/lib/outfit-history";
import type { OutfitRow } from "@/services/supabase/outfits";
import { radii } from "@/theme/tokens";

/**
 * One saved look in the history grid.
 *
 * The row may be a generated look or a Lens analysis — the same table holds
 * both — so the title comes from whichever shape it turns out to be, and an
 * unrecognised row still renders rather than blanking the cell.
 */
export function LookCard({ outfit, onPress }: { outfit: OutfitRow; onPress: () => void }) {
  const entry = normalizeAnalysisResult(outfit.analysis_result);

  const title =
    entry.kind === "daily_look"
      ? entry.look.outfit.headline || "Saved look"
      : entry.kind === "lens"
        ? "Lens analysis"
        : "Saved look";

  const date = new Date(outfit.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${date}`}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
      className="flex-1 gap-sm"
    >
      <Image
        source={{ uri: outfit.image_url }}
        // Case 1 of the StyleSheet exceptions: expo-image takes a style object.
        style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.panel }}
        contentFit="cover"
        transition={150}
      />
      <View className="gap-xs">
        <Text numberOfLines={2} className="font-body-medium text-sm text-ink">
          {title}
        </Text>
        <View className="flex-row items-center gap-sm">
          <Text className="font-body text-micro text-muted">{date}</Text>
          {entry.kind === "lens" ? <Badge label="Lens" variant="neutral" /> : null}
        </View>
      </View>
    </Pressable>
  );
}
