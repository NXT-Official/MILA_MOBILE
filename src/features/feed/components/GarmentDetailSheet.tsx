import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { DupeMatchCard } from "@/components/ui/DupeMatchCard";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { queryKeys } from "@/constants/query-keys";
import { useHaptics } from "@/hooks/use-haptics";
import { useProfile } from "@/hooks/use-profile";
import { sourceUrlHost, type PostItem } from "@/lib/outfit-items";
import { findSimilarItems, type DupeMatch } from "@/services/api/items";
import { cn } from "@/utils/cn";

/** The catalogue barely moves in a day, and this is a free query worth caching hard. */
const MATCH_CACHE_MS = 24 * 60 * 60 * 1000;

/** The web's `ShopSort`, verbatim — the drawer's select offers the same three. */
type ShopSort = "best_match" | "price_low" | "price_high";

const SORT_OPTIONS: { value: ShopSort; label: string }[] = [
  { value: "best_match", label: "Best match" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
];

/** The web's `sortMatches`, verbatim; `best_match` keeps the server's ranking. */
function sortMatches(matches: DupeMatch[], sort: ShopSort): DupeMatch[] {
  if (sort === "price_low") return [...matches].sort((a, b) => a.price - b.price);
  if (sort === "price_high") return [...matches].sort((a, b) => b.price - a.price);
  return matches;
}

/**
 * What a garment is, and what else looks like it.
 *
 * One sheet, not two. The web presents attributes, the poster's link, and the
 * similar pieces in a single drawer, and splitting them would mean stacking a
 * second bottom sheet on the first — which on Android puts two dismiss gestures
 * on top of each other.
 *
 * The sort is inline radio pills for the same reason: it is the mobile form of
 * the web drawer's select, not another sheet.
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
  const { data: profile } = useProfile();
  const { data: similar, isPending } = useQuery({
    queryKey: queryKeys.similarItems(item?.id ?? ""),
    enabled: Boolean(item),
    staleTime: MATCH_CACHE_MS,
    gcTime: MATCH_CACHE_MS,
    // `region` matches the web's call — the server ranks with it, and without
    // it the same garment returns different matches on phone and web.
    queryFn: () =>
      findSimilarItems({
        attributes: (item as PostItem).attributes,
        region: profile?.delivery_country || undefined,
      }),
  });

  const haptics = useHaptics();
  const [sort, setSort] = useState<ShopSort>("best_match");
  const matches = sortMatches(similar ?? [], sort);

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

            {!isPending && matches.length > 1 ? (
              <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-sm">
                {SORT_OPTIONS.map((option) => {
                  const selected = option.value === sort;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={option.label}
                      onPress={() => {
                        haptics.selection();
                        setSort(option.value);
                      }}
                      className={cn(
                        "active:opacity-90 min-h-tap flex-row items-center gap-sm rounded-pill border px-lg py-md",
                        selected
                          ? "border-ink bg-accent-soft"
                          : "border-border bg-surface dark:border-border/12",
                      )}
                    >
                      {selected ? <Icon name="check" size="xs" color="ink" /> : null}
                      <Text
                        className={cn(
                          "font-body-medium text-sm",
                          selected ? "text-ink" : "text-body",
                        )}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

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
                {matches.map((match) => (
                  // Saved as found on a feed post's garment, linked to that
                  // post item; Lens Dupe Hunter results keep the "dupe" default.
                  <DupeMatchCard
                    key={match.id}
                    match={match}
                    saveSource="post_item"
                    postItemId={item.id}
                  />
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
      className="active:opacity-80 min-h-tap flex-row items-center justify-between gap-md rounded-panel border border-border bg-surface px-lg py-md dark:border-border/12"
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
