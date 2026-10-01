import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PostItem } from "@/lib/outfit-items";
import type { FeedPost } from "@/services/api/posts";
import { spacing } from "@/theme/tokens";

import { FeedCard } from "./components/FeedCard";
import { GarmentDetailSheet } from "./components/GarmentDetailSheet";
import { PostContextMenu } from "./components/PostContextMenu";
import { useFeed } from "./hooks/use-feed";

/**
 * The community feed — the web's Atelier Feed, in one column.
 *
 * An editorial masthead over a scrolling column of cards. Reading is open:
 * the web shows the same list without a reciprocity gate, and the server still
 * returns `has_posted_today` for anything that later wants it.
 *
 * `FlatList`, not `FlashList`. The endpoint returns at most 80 posts, and the
 * thing that actually prevents the OOM is `recyclingKey` on the images, which is
 * an `expo-image` prop and applies either way.
 *
 * If the feed ever outgrows the 80-post cap — Appendix D.5 proposes pagination —
 * this is the decision to revisit.
 */
export function FeedScreen() {
  const insets = useSafeAreaInsets();

  /** One sheet for the whole list, not one per card. */
  const [openItem, setOpenItem] = useState<PostItem | null>(null);
  const [menuPost, setMenuPost] = useState<FeedPost | null>(null);

  const { data, isPending, isError, refetch, isRefetching } = useFeed();

  if (isPending) {
    return (
      <Frame>
        <Masthead />
        <View className="gap-xl">
          <Skeleton className="aspect-[3/4] w-full rounded-card" />
          <Skeleton className="aspect-[3/4] w-full rounded-card" />
        </View>
      </Frame>
    );
  }

  if (isError) {
    return (
      <Frame>
        <View className="flex-1 justify-center">
          <ErrorState
            title="The feed didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        </View>
      </Frame>
    );
  }

  const posts = data?.posts ?? [];

  if (posts.length === 0) {
    return (
      <Frame>
        <Masthead />
        <EmptyState
          icon="feed"
          title="You're first to the mirror today"
          description="As your circle posts, their looks will land here."
        />
      </Frame>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        ListHeaderComponent={Masthead}
        showsVerticalScrollIndicator={false}
        // The memory guard, alongside `recyclingKey` in the card: hold a few
        // screens of photography, not eighty.
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        // Case 1 of the StyleSheet exceptions: a list's content padding is a
        // style object by the FlatList API. The tab bar's clearance is already
        // held open by the navigator's `sceneStyle`.
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        renderItem={({ item }) => (
          <FeedCard
            post={item}
            // A signed URL expired mid-session. Refetching re-signs every URL on
            // the page rather than retrying one dead link.
            onExpired={() => void refetch()}
            onLongPress={setMenuPost}
            onOpenAuthor={(userId) => router.push(`/profile/${userId}`)}
            onOpenBlueprint={() => router.push("/history")}
            onSelectItem={setOpenItem}
          />
        )}
      />

      <GarmentDetailSheet item={openItem} onClose={() => setOpenItem(null)} />
      <PostContextMenu post={menuPost} onClose={() => setMenuPost(null)} />
    </View>
  );
}

/**
 * The masthead the web feed opens with: eyebrow, serif promise, one line of
 * copy, and the single action on the screen.
 */
function Masthead() {
  return (
    <View className="items-center gap-md pb-xl pt-lg">
      <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
        The Atelier Feed
      </Text>
      <Text className="font-display text-h1 tracking-heading text-ink text-center">
        Today&apos;s looks, in real time
      </Text>
      <Text className="font-body text-base text-body text-center">
        One outfit, one mirror, one mood — your community&apos;s daily blueprints.
      </Text>
      <Button
        label="Post today's OOTD"
        icon="camera"
        size="pill"
        onPress={() => router.push("/publish")}
        className="mt-sm"
      />
    </View>
  );
}

/** The non-list states share the feed's frame, so they sit where the feed would. */
function Frame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas px-xl" style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );
}
