import { Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { DupeMatchCard } from "@/components/ui/DupeMatchCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DupeHuntResult } from "@/services/api/items";

/**
 * What Mila read in the inspiration piece, then what the catalogue has that
 * looks like it.
 *
 * The attributes come first for the same reason the web leads with them: they
 * are the member's check that Mila looked at the right thing before she judges
 * the matches under them.
 */
export function DupeResultCard({ result }: { result: DupeHuntResult }) {
  const { inspiration, dupes } = result;

  return (
    <View className="gap-xl">
      <View className="gap-sm rounded-panel border border-border bg-surface p-lg dark:border-border/12">
        <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
          Inspiration
        </Text>
        <Text className="font-display text-h3 text-ink">{inspiration.name}</Text>
        <Text className="font-body text-sm text-body">
          {[inspiration.category, inspiration.primary_color, inspiration.color_undertone]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {inspiration.silhouette_tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-sm pt-xs">
            {inspiration.silhouette_tags.slice(0, 4).map((tag) => (
              <Badge key={tag} label={tag} />
            ))}
          </View>
        ) : null}
      </View>

      <View className="gap-md">
        <Text
          accessibilityRole="header"
          className="font-body-semibold text-section tracking-section uppercase text-muted"
        >
          {dupes.length > 0 ? `${dupes.length} budget alternatives` : "Budget alternatives"}
        </Text>

        {dupes.length > 0 ? (
          <View className="flex-row flex-wrap gap-md">
            {dupes.map((match) => (
              <DupeMatchCard key={match.id} match={match} />
            ))}
          </View>
        ) : (
          <View className="gap-xs rounded-panel border border-border bg-surface-alt p-lg dark:border-border/12">
            <Text className="font-display text-base text-ink">
              No close matches in the catalogue yet.
            </Text>
            <Text className="font-body text-sm text-body">
              Try a cleaner background or a different angle.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Mirrors the card above — the inspiration block, then a row of match tiles —
 * so nothing jumps when the hunt lands. A skeleton, never a spinner (§10).
 */
export function DupeSkeleton() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Mila is scanning the piece"
      accessibilityState={{ busy: true }}
      className="gap-xl"
    >
      <View className="gap-sm rounded-panel border border-border bg-surface p-lg dark:border-border/12">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </View>
      <View className="flex-row gap-md">
        <Skeleton className="aspect-[3/4] flex-1 rounded-panel" />
        <Skeleton className="aspect-[3/4] flex-1 rounded-panel" />
      </View>
    </View>
  );
}
