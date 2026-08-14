import { useQuery } from "@tanstack/react-query";
import { Linking, Pressable, Text, View } from "react-native";

import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { queryKeys } from "@/constants/query-keys";
import { sourceUrlHost, type PostItem } from "@/lib/outfit-items";
import { findSimilarItems, type DupeMatch } from "@/services/api/items";
import { radii } from "@/theme/tokens";
import { formatPrice } from "@/utils/format-price";

/** The catalogue barely moves in a day, and this is a free query worth caching hard. */
const MATCH_CACHE_MS = 24 * 60 * 60 * 1000;

/**
 * What a garment is, and what else looks like it.
 *
 * One sheet, not two. The web presents attributes, the poster's link, and the
 * similar pieces in a single drawer, and splitting them would mean stacking a
 * second bottom sheet on the first — which on Android puts two dismiss gestures
 * on top of each other.
 *
 * **"Find similar" is free.** `/dupes/similar` runs no AI call: the attributes
 * were catalogued when the post was analysed, so this is a catalogue query. It
 * is never gated behind the paywall and it charges nothing.
 */
export function GarmentDetailSheet({
  item,
  onClose,
}: {
  item: PostItem | null;
  onClose: () => void;
}) {
  const { data: similar, isPending } = useQuery({
    queryKey: queryKeys.similarItems(item?.id ?? ""),
    enabled: Boolean(item),
    staleTime: MATCH_CACHE_MS,
    gcTime: MATCH_CACHE_MS,
    queryFn: () => findSimilarItems({ attributes: (item as PostItem).attributes }),
  });

  return (
    <Sheet visible={Boolean(item)} onClose={onClose} title={item?.label ?? ""}>
      {item ? (
        <View className="gap-xl">
          <View className="gap-xs">
            <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
              {item.category}
            </Text>
            <Text className="font-body text-base text-body">
              {[item.attributes.primary_color, ...item.attributes.silhouette_tags]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>

          {item.source_url ? <SourceLink url={item.source_url} /> : null}

          <View className="gap-md">
            <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
              Similar pieces
            </Text>

            {isPending ? (
              <View className="flex-row gap-md">
                <Skeleton className="aspect-[3/4] flex-1 rounded-panel" />
                <Skeleton className="aspect-[3/4] flex-1 rounded-panel" />
              </View>
            ) : !similar?.length ? (
              <View className="gap-xs rounded-panel border border-border bg-surface-alt p-lg dark:border-border/12">
                <Text className="font-display text-base text-ink">
                  Nothing close in the catalogue yet.
                </Text>
                <Text className="font-body text-sm text-body">
                  Mila&apos;s shelf grows every week — check back on this piece.
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-md">
                {similar.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </View>
            )}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

/**
 * The **hostname**, never the raw URL. A poster-supplied link is untrusted, and
 * a full URL rendered verbatim can be dressed to impersonate another domain.
 */
function SourceLink({ url }: { url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open the poster's link to ${sourceUrlHost(url)}`}
      onPress={() => void Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
      className="min-h-tap flex-row items-center justify-between gap-md rounded-panel border border-border bg-surface px-lg py-md dark:border-border/12"
    >
      <View className="flex-1 gap-xs">
        <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
          Poster&apos;s link
        </Text>
        <Text numberOfLines={1} className="font-display text-base text-ink">
          {sourceUrlHost(url)}
        </Text>
      </View>
      <Icon name="external" size="sm" color="muted" />
    </Pressable>
  );
}

function MatchCard({ match }: { match: DupeMatch }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${match.title}, ${formatPrice(match.price, match.currency)}`}
      onPress={() => void Linking.openURL(match.affiliate_link).catch(() => {})}
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
      className="flex-1 gap-sm"
    >
      <ImageWithFallback
        uri={match.image_url}
        recyclingKey={match.id}
        accessibilityLabel={match.title}
        style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.panel }}
      />
      <View className="gap-xs">
        <Text numberOfLines={2} className="font-body-medium text-sm text-ink">
          {match.title}
        </Text>
        <Text className="font-body text-micro text-muted">
          {formatPrice(match.price, match.currency)}
        </Text>
      </View>
    </Pressable>
  );
}
