import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { normalizeAnalysisResult, outfitTitle } from "@/lib/outfit-history";
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

  const title = outfitTitle(entry);
  // The web's card carries the vibe and the match score; both are read-only
  // facts about the row, so the grid shows them too.
  const vibe = entry.kind === "daily_look" ? entry.vibe : null;

  const date = new Date(outfit.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${date}`}
      onPress={onPress}
      className="active:opacity-90 flex-1 gap-sm"
    >
      {outfit.image_url ? (
        <Image
          source={{ uri: outfit.image_url }}
          // Case 1 of the StyleSheet exceptions: expo-image takes a style object.
          style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.panel }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        // Auto-saved before its visual existed — there is just no picture yet.
        <View
          style={{ aspectRatio: 3 / 4, borderRadius: radii.panel }}
          className="w-full items-center justify-center bg-accent-soft/50 dark:bg-accent-soft/20"
        >
          <Text className="font-body text-micro text-muted">No visual yet</Text>
        </View>
      )}
      <View className="gap-xs">
        {vibe ? (
          <Text className="font-body text-micro tracking-label uppercase text-muted">{vibe}</Text>
        ) : null}
        <Text numberOfLines={2} className="font-body-medium text-sm text-ink">
          {title}
        </Text>
        <View className="flex-row items-center gap-sm">
          <Text className="font-body text-micro text-muted">{date}</Text>
          {outfit.match_score != null ? (
            <Text className="font-body text-micro text-muted">· {outfit.match_score}</Text>
          ) : null}
          {entry.kind === "lens" ? <Badge label="Lens" variant="neutral" /> : null}
        </View>
      </View>
    </Pressable>
  );
}
