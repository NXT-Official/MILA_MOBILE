import { Pressable, Text, View, useWindowDimensions } from "react-native";

import { AvatarInitial } from "@/components/media/AvatarInitial";
import { RemoteImage } from "@/components/media/RemoteImage";
import { Badge } from "@/components/ui/Badge";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import type { PostItem } from "@/lib/outfit-items";
import type { FeedPost } from "@/services/api/posts";
import { radii, spacing } from "@/theme/tokens";
import { relativeTime } from "@/utils/relative-time";

import { GarmentHotspot } from "./GarmentHotspot";

/**
 * One post, one viewport.
 *
 * The back capture is the outfit and fills the card; the front portrait is a
 * small disc over it, which is how the web reads and is the right hierarchy —
 * this is a feed of clothes, not of faces.
 *
 * `recyclingKey` on both images is the OOM guard: without it a recycled row
 * shows the previous post's photograph while the new one decodes, and 80 posts
 * of full-bleed photography is exactly the shape that exhausts a cheap phone.
 *
 * The garment sheet is **not** rendered here. One sheet lives on the screen and
 * this card only reports which item was tapped — a bottom-sheet modal and its
 * query per card would be three of each in the render window, for one that can
 * ever be open.
 */
export function FeedCard({
  post,
  onExpired,
  onLongPress,
  onOpenAuthor,
  onSelectItem,
}: {
  post: FeedPost;
  /** A signed URL stopped working — refetch the feed. */
  onExpired: () => void;
  /** Own posts only; the context menu has no meaning on someone else's. */
  onLongPress: (post: FeedPost) => void;
  onOpenAuthor: (userId: string) => void;
  onSelectItem: (item: PostItem) => void;
}) {
  const { height } = useWindowDimensions();
  const author = post.is_self ? "You" : post.author_name?.trim() || "Member";

  return (
    // One post per viewport (§3). Height comes from `useWindowDimensions`, never
    // a fixed value — it has to survive a rotation and a foldable.
    <View style={{ height }} className="justify-center gap-md px-lg">
      <Header
        author={author}
        verified={post.author_verified}
        createdAt={post.created_at}
        isSelf={post.is_self}
        onPress={() => onOpenAuthor(post.user_id)}
      />

      <Pressable
        // Long-press rather than inline controls (§3): an edit and a delete
        // button on every card would put a destructive action one mis-tap from
        // a scroll gesture.
        onLongPress={post.is_self ? () => onLongPress(post) : undefined}
        accessibilityRole={post.is_self ? "button" : undefined}
        accessibilityLabel={post.is_self ? "Your post. Long press for options." : undefined}
        delayLongPress={400}
        // Case 1 of the StyleSheet exceptions: `overflow: hidden` with a radius
        // has to sit on the same node the absolute children clip to.
        style={{ borderRadius: radii.card, overflow: "hidden" }}
        className="w-full"
      >
        <RemoteImage
          uri={post.image_url_back}
          recyclingKey={`${post.id}-back`}
          accessibilityLabel={`${author}'s outfit`}
          onExpired={onExpired}
          style={{ width: "100%", aspectRatio: 3 / 4 }}
        />

        <View
          style={{ position: "absolute", top: spacing.lg, left: spacing.lg }}
          className="h-3xl w-3xl overflow-hidden rounded-pill border border-canvas"
        >
          <RemoteImage
            uri={post.image_url_front}
            recyclingKey={`${post.id}-front`}
            accessibilityLabel={`${author}'s portrait`}
            onExpired={onExpired}
            style={{ width: "100%", height: "100%" }}
          />
        </View>

        {post.items.map((item) => (
          <GarmentHotspot key={item.id} item={item} onPress={() => onSelectItem(item)} />
        ))}
      </Pressable>

      {post.caption ? (
        <Text numberOfLines={4} className="font-display text-base text-ink">
          {post.caption}
        </Text>
      ) : null}
    </View>
  );
}

function Header({
  author,
  verified,
  createdAt,
  isSelf,
  onPress,
}: {
  author: string;
  verified: boolean;
  createdAt: string;
  isSelf: boolean;
  onPress: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-md">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${author}'s profile`}
        onPress={onPress}
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
        className="min-h-tap flex-1 flex-row items-center gap-md"
      >
        <AvatarInitial name={author} />
        <View className="flex-1 gap-xs">
          <View className="flex-row items-center gap-xs">
            <Text numberOfLines={1} className="font-display text-sm text-ink">
              {author}
            </Text>
            {verified ? <VerifiedBadge /> : null}
          </View>
          <Text className="font-body text-micro text-muted">{relativeTime(createdAt)}</Text>
        </View>
      </Pressable>

      {isSelf ? <Badge label="Yours" variant="neutral" /> : null}
    </View>
  );
}
