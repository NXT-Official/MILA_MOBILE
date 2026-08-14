import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PostItem } from "@/lib/outfit-items";
import type { FeedPost } from "@/services/api/posts";
import { shadows, spacing } from "@/theme/tokens";

import { FeedCard } from "./components/FeedCard";
import { GarmentDetailSheet } from "./components/GarmentDetailSheet";
import { PostContextMenu } from "./components/PostContextMenu";
import { useFeed } from "./hooks/use-feed";

/**
 * The community feed. One post per viewport, vertically paged.
 *
 * `FlatList`, not `FlashList`. The endpoint returns at most 80 posts and each
 * one fills the screen, so the render window is never more than about three
 * cards — well inside what `FlatList` handles, and one fewer native dependency
 * on the highest-risk row of the Phase 0 ratification table. The thing that
 * actually prevents the OOM is `recyclingKey` on the images, which is an
 * `expo-image` prop and applies either way.
 *
 * If the feed ever outgrows the 80-post cap — Appendix D.5 proposes pagination —
 * this is the decision to revisit.
 */
export function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  /** One sheet for the whole list, not one per card. */
  const [openItem, setOpenItem] = useState<PostItem | null>(null);
  const [menuPost, setMenuPost] = useState<FeedPost | null>(null);

  const { data, isPending, isError, refetch, isRefetching } = useFeed();

  if (isPending) {
    return (
      <Frame>
        <View className="flex-1 justify-center gap-md px-lg">
          <Skeleton className="h-2xl w-1/2" />
          <Skeleton className="aspect-[3/4] w-full rounded-card" />
          <Skeleton className="h-5 w-3/4" />
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
        <View className="flex-1 justify-center">
          {/* An invitation, not a blank scroll (§10). The copy names what will
              fill the screen, and the action is the one that fills it. */}
          <EmptyState
            icon="feed"
            title="No looks yet today"
            description="Be the first. Post what you are wearing and it lands here."
            actionLabel="Post your outfit"
            onAction={() => router.push("/publish")}
          />
        </View>
        <PublishButton hasPosted={data?.has_posted_today ?? false} />
      </Frame>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        // One post per viewport (§3). `getItemLayout` lets the list skip
        // measuring — every row is exactly the window height.
        pagingEnabled
        snapToInterval={height}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        // The memory guard, alongside `recyclingKey` in the card: hold three
        // screens of cards, not eighty.
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        contentContainerStyle={{ paddingTop: insets.top }}
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
            onSelectItem={setOpenItem}
          />
        )}
      />

      <PublishButton hasPosted={data?.has_posted_today ?? false} />

      <GarmentDetailSheet item={openItem} onClose={() => setOpenItem(null)} />
      <PostContextMenu post={menuPost} onClose={() => setMenuPost(null)} />
    </View>
  );
}

/**
 * The publish affordance. Gold, and it carries the single accent job on this
 * screen — the feed is otherwise all photography.
 */
function PublishButton({ hasPosted }: { hasPosted: boolean }) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasPosted ? "Post another outfit" : "Post your outfit"}
      onPress={() => router.push("/publish")}
      // Case 1 of the StyleSheet exceptions: an absolute offset computed from a
      // safe-area inset, plus a shadow, which is a native primitive.
      style={[
        { position: "absolute", right: spacing.xl, bottom: insets.bottom + spacing.xl },
        shadows.raised,
      ]}
      className="h-tile w-tile items-center justify-center rounded-pill bg-accent"
    >
      <Icon name="add" size="lg" color="ink" />
    </Pressable>
  );
}

/** The non-list states share a frame so they sit where the feed would. */
function Frame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );
}
