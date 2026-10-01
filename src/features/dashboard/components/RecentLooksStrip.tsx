import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { RemoteImage } from "@/components/media/RemoteImage";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { recentLooks } from "@/lib/dashboard-stats";
import type { OutfitRow } from "@/services/supabase/outfits";
import { relativeTime } from "@/utils/relative-time";

/**
 * The web's Recent Looks strip — the last six looks, newest first, with its
 * "View all" opening History. On mobile it is a horizontal scroll (a deliberate
 * carousel, §10) rather than the web's overflow row, and a tile opens the look
 * instead of deep-linking History: same destination, one tap closer.
 *
 * The rows come from `useOutfits`, the query History already owns — the web
 * runs a separate stats query, but there is one source of truth for a member's
 * own looks on both clients.
 */
export function RecentLooksStrip({
  looks,
  loading,
  onExpired,
}: {
  looks: OutfitRow[] | undefined;
  loading: boolean;
  /** A signed URL stopped working — refetch the rows. */
  onExpired: () => void;
}) {
  const recent = looks ? recentLooks(looks) : [];

  return (
    <Card className="gap-lg p-lg">
      <View className="flex-row items-center justify-between gap-md">
        <Text accessibilityRole="header" className="font-display text-lg text-ink">
          Recent Looks
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="View all your looks in History"
          onPress={() => router.push("/history")}
          hitSlop={8}
          className="active:opacity-60 min-h-tap justify-center"
        >
          <Text className="font-body-semibold text-micro tracking-label uppercase text-muted">
            View all
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-row gap-md overflow-hidden">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28 w-24" />
          ))}
        </View>
      ) : recent.length === 0 ? (
        <EmptyState
          icon="feed"
          title="No looks yet"
          description="Generate today's look to start building your history."
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12 }}
        >
          {recent.map((look) => (
            <Pressable
              key={look.id}
              accessibilityRole="button"
              accessibilityLabel={`Saved look from ${relativeTime(look.created_at)}`}
              onPress={() => router.push(`/look/${look.id}`)}
              className="active:opacity-90 h-28 w-24 overflow-hidden rounded-control border border-border dark:border-border/12"
            >
              <RemoteImage
                uri={look.image_url}
                recyclingKey={look.id}
                accessibilityLabel={`Saved look from ${relativeTime(look.created_at)}`}
                onExpired={onExpired}
                style={{ width: "100%", height: "100%" }}
              />
              <View className="absolute inset-x-0 bottom-0 bg-ink/60 px-sm py-xs">
                <Text className="font-body text-label text-on-ink" numberOfLines={1}>
                  {relativeTime(look.created_at)}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Card>
  );
}
