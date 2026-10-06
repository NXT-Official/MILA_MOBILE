import { Pressable, Text, View } from "react-native";

import { AvatarInitial } from "@/components/media/AvatarInitial";
import { RemoteImage } from "@/components/media/RemoteImage";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import type { PostItem } from "@/lib/outfit-items";
import type { FeedPost } from "@/services/api/posts";
import { spacing } from "@/theme/tokens";
import { relativeTime } from "@/utils/relative-time";

import { GarmentHotspot } from "./GarmentHotspot";

/**
 * One post, as an editorial card — header, the outfit, then the caption. This
 * mirrors the web's `PostCanvas`: the feed scrolls as a column of cards rather
 * than paging one post per viewport, so a member can scan the day's looks the
 * way they read the rest of Mila.
 *
 * The back capture is the outfit and fills the card; the front portrait is a
 * small disc over it, which is the right hierarchy — this is a feed of clothes,
 * not of faces.
 *
 * `recyclingKey` on both images is the OOM guard: without it a recycled row
 * shows the previous post's photograph while the new one decodes, and 80 posts
 * of photography is exactly the shape that exhausts a cheap phone.
 *
 * The garment sheet is **not** rendered here. One sheet lives on the screen and
 * this card only reports which item was tapped — a bottom-sheet modal and its
 * query per card would be several of each in the render window, for one that can
 * ever be open.
 */
export function FeedCard({
  post,
  onExpired,
  onLongPress,
  onOpenAuthor,
  onOpenBlueprint,
  onSelectItem,
}: {
  post: FeedPost;
  /** A signed URL stopped working — refetch the feed. */
  onExpired: () => void;
  /** Own posts only; the context menu has no meaning on someone else's. */
  onLongPress: (post: FeedPost) => void;
  onOpenAuthor: (userId: string) => void;
  /** Own posts only, and only when the post was published from a generated look. */
  onOpenBlueprint: () => void;
  onSelectItem: (item: PostItem) => void;
}) {
  const author = post.is_self ? "You" : post.author_name?.trim() || "Member";
  // The blueprint opens the viewer's own History. A look is private to its
  // author, so on someone else's post there is nothing of theirs to open.
  const showBlueprint = post.is_self && Boolean(post.generated_look_id);

  return (
    // The card clips the photograph to its own radius, so the image needs no
    // radius of its own — and the portrait disc and hotspots clip with it.
    <Card floating className="overflow-hidden p-0">
      <View className="px-lg py-md">
        <Header
          author={author}
          verified={post.author_verified}
          createdAt={post.created_at}
          isSelf={post.is_self}
          onPress={() => onOpenAuthor(post.user_id)}
        />
      </View>

      <Pressable
        // Long-press rather than inline controls (§3): an edit and a delete
        // button on every card would put a destructive action one mis-tap from
        // a scroll gesture.
        onLongPress={post.is_self ? () => onLongPress(post) : undefined}
        accessibilityRole={post.is_self ? "button" : undefined}
        accessibilityLabel={post.is_self ? "Your post. Long press for options." : undefined}
        delayLongPress={400}
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

      {post.caption || showBlueprint ? (
        <View className="gap-md px-lg py-lg">
          {post.caption ? (
            <Text numberOfLines={4} className="font-display text-base text-ink">
              {post.caption}
            </Text>
          ) : null}

          {showBlueprint ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View the AI blueprint behind this look"
              onPress={onOpenBlueprint}
              className="active:opacity-70 min-h-tap flex-row items-center gap-sm"
            >
              <Icon name="sparkle" size="xs" color="muted" />
              <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
                View AI blueprint
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
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
        className="active:opacity-70 min-h-tap flex-1 flex-row items-center gap-md"
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

      {isSelf ? <Badge label="Today's OOTD" variant="neutral" /> : null}
    </View>
  );
}
