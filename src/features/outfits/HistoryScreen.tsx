import { router } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOutfits } from "@/hooks/use-outfits";
import { spacing } from "@/theme/tokens";

import { LookCard } from "./components/LookCard";

/**
 * Every saved look, newest first. Two columns — the §10 "no tables, single
 * column" rule governs content, and a grid of images is not a table.
 *
 * `FlatList` rather than a mapped ScrollView: this list grows without bound and
 * every cell holds a remote image.
 */
export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { data: outfits, isPending, isError, refetch, isRefetching } = useOutfits();

  if (isPending) {
    return (
      <Frame>
        <View className="flex-row flex-wrap gap-md">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="flex-1 gap-sm" style={{ minWidth: 140 }}>
              <Skeleton className="aspect-[3/4] w-full rounded-panel" />
              <Skeleton className="h-4 w-3/4" />
            </View>
          ))}
        </View>
      </Frame>
    );
  }

  if (isError) {
    return (
      <Frame>
        <ErrorState
          title="History didn't load"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      </Frame>
    );
  }

  if (!outfits || outfits.length === 0) {
    return (
      <Frame>
        <EmptyState
          icon="outfit"
          title="Nothing saved yet"
          description="Looks you save from Home land here, newest first."
          actionLabel="Compose today's look"
          onAction={() => router.replace("/")}
        />
      </Frame>
    );
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="px-xl pb-md pt-md">
        <Text accessibilityRole="header" className="font-display text-h1 tracking-heading text-ink">
          History
        </Text>
      </View>

      <FlatList
        data={outfits}
        keyExtractor={(item) => item.id}
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
        renderItem={({ item }) => (
          <LookCard outfit={item} onPress={() => router.push(`/look/${item.id}`)} />
        )}
      />
    </View>
  );
}

/** The non-list states share a frame so they sit where the grid would. */
function Frame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas px-xl" style={{ paddingTop: insets.top }}>
      <View className="pb-lg pt-md">
        <Text accessibilityRole="header" className="font-display text-h1 tracking-heading text-ink">
          History
        </Text>
      </View>
      <View className="flex-1 justify-center pb-2xl">{children}</View>
      <View className="pb-lg">
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}
