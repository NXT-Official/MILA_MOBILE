import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvatarInitial } from "@/components/media/AvatarInitial";
import { RemoteImage } from "@/components/media/RemoteImage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/utils/cn";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { queryKeys } from "@/constants/query-keys";
import { getMemberProfile, type FeedPost } from "@/services/api/posts";
import { radii, spacing } from "@/theme/tokens";
import { relativeTime } from "@/utils/relative-time";

/**
 * A member's posts, own or someone else's.
 *
 * `can_view_hidden` is computed **server-side** and arrives with the payload —
 * the client never decides it. On mobile it is true only for one's own profile:
 * the moderation role that would also satisfy it server-side does not exist in
 * this application, and no surface here may introduce one.
 */
export function MemberProfileScreen({ userId }: { userId: string }) {
  const insets = useSafeAreaInsets();
  const [showHidden, setShowHidden] = useState(false);

  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.memberProfile(userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: () => getMemberProfile(userId),
  });

  if (isPending) {
    return (
      <Frame>
        <View className="gap-lg px-xl pt-lg">
          <Skeleton className="h-3xl w-3xl rounded-pill" />
          <Skeleton className="h-6 w-1/2" />
          <View className="flex-row gap-md">
            <Skeleton className="aspect-[3/4] flex-1 rounded-panel" />
            <Skeleton className="aspect-[3/4] flex-1 rounded-panel" />
          </View>
        </View>
      </Frame>
    );
  }

  if (isError || !data) {
    return (
      <Frame>
        <View className="flex-1 justify-center">
          <ErrorState
            title="This profile didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        </View>
        <View className="px-xl pb-lg">
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </Frame>
    );
  }

  const name = data.profile.full_name?.trim() || data.profile.username || "Member";

  /**
   * The server decides what arrives; this only sorts it into the two tabs. When
   * `can_view_hidden` is false the payload contains no hidden posts at all, so
   * the filter is a no-op and the tabs are not rendered.
   *
   * A hidden post is one a moderator took down on the web. Mobile shows the
   * owner that it happened and nothing more — there is no appeal control, no
   * reason editor, and no moderation surface of any kind in this application.
   */
  const posts = data.can_view_hidden
    ? data.posts.filter((post) => Boolean(post.hidden) === showHidden)
    : data.posts;

  // The count under the name is her public body of work, not the current tab —
  // "0 looks" beside a name while standing in the Hidden tab is just wrong.
  const visibleCount = data.posts.filter((post) => !post.hidden).length;

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        numColumns={2}
        // Third-party props that take style objects — case 1 of the exceptions.
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing["2xl"],
          gap: spacing.lg,
        }}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListHeaderComponent={
          <View className="gap-lg pb-lg pt-md">
            <View className="flex-row items-center gap-md">
              <AvatarInitial name={name} className="h-3xl w-3xl" />
              <View className="flex-1 gap-xs">
                <View className="flex-row items-center gap-xs">
                  <Text
                    accessibilityRole="header"
                    numberOfLines={1}
                    className="font-display text-h2 tracking-heading text-ink"
                  >
                    {name}
                  </Text>
                  {data.profile.verified ? <VerifiedBadge /> : null}
                </View>
                <Text className="font-body text-sm text-body">
                  {visibleCount} {visibleCount === 1 ? "look" : "looks"}
                </Text>
              </View>
            </View>

            {/* Own profile only — the server decides, and it is the only thing
                that separates these two screens. */}
            {data.can_view_hidden ? (
              <View className="flex-row gap-sm">
                <Tab label="Posts" active={!showHidden} onPress={() => setShowHidden(false)} />
                <Tab label="Hidden" active={showHidden} onPress={() => setShowHidden(true)} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View className="py-3xl">
            <EmptyState
              icon="feed"
              title={showHidden ? "Nothing hidden" : "No looks yet"}
              description={
                showHidden
                  ? "None of your looks have been taken down."
                  : data.can_view_hidden
                    ? "Post what you are wearing and it lands here."
                    : "This member hasn't posted an outfit yet."
              }
              actionLabel={data.can_view_hidden && !showHidden ? "Post your outfit" : undefined}
              onAction={
                data.can_view_hidden && !showHidden ? () => router.push("/publish") : undefined
              }
            />
          </View>
        }
        ListFooterComponent={
          <View className="pt-lg">
            <Button label="Back" variant="secondary" onPress={() => router.back()} />
          </View>
        }
        renderItem={({ item }) => <ProfileTile post={item} onExpired={() => void refetch()} />}
      />
    </View>
  );
}

function ProfileTile({ post, onExpired }: { post: FeedPost; onExpired: () => void }) {
  return (
    <View className="flex-1 gap-sm">
      <RemoteImage
        uri={post.image_url_back}
        recyclingKey={post.id}
        accessibilityLabel="A saved look"
        onExpired={onExpired}
        style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.panel }}
      />
      <Text className="font-body text-micro text-muted">{relativeTime(post.created_at)}</Text>
    </View>
  );
}

function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      // Selection is carried by the border weight and the wash together, never
      // by hue alone (§10).
      className={cn(
        "active:opacity-80 min-h-tap flex-row items-center rounded-pill border px-lg",
        active
          ? "border-ink bg-accent-soft"
          : "border-border bg-surface dark:border-border/12",
      )}
    >
      <Text
        className={
          active
            ? "font-body-semibold text-label tracking-label uppercase text-ink"
            : "font-body-semibold text-label tracking-label uppercase text-body"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );
}
