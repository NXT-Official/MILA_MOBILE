import { router } from "expo-router";
import { useState } from "react";
import { SectionList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRemoveSavedProduct, useSavedProducts } from "@/hooks/use-saved-products";
import { garmentFor, type Garment, type GarmentKind } from "@/lib/garment-label";
import type { SavedProduct } from "@/services/supabase/saved-products";
import { spacing } from "@/theme/tokens";

import { SavedPieceCard } from "./components/SavedPieceCard";

/** Wardrobe order, head to toe then the extras. Empty groups are not drawn. */
const GROUPS: readonly { kind: GarmentKind; title: string }[] = [
  { kind: "top", title: "Tops" },
  { kind: "bottoms", title: "Bottoms" },
  { kind: "dress", title: "Dresses" },
  { kind: "outerwear", title: "Outerwear" },
  { kind: "shoes", title: "Shoes" },
  { kind: "bag", title: "Bags" },
  { kind: "jewelry", title: "Jewelry" },
  { kind: "accessory", title: "Accessories" },
  { kind: "unknown", title: "Other pieces" },
];

type Entry = { item: SavedProduct; garment: Garment };

/** Newest first within each group, as the list arrives. */
function groupByGarment(items: SavedProduct[]) {
  const entries: Entry[] = items.map((item) => ({
    item,
    garment: garmentFor(item.snapshot.category, item.snapshot.title),
  }));
  return GROUPS.map((group) => ({
    title: group.title,
    data: entries.filter((entry) => entry.garment.kind === group.kind),
  })).filter((section) => section.data.length > 0);
}

const REMOVE_MESSAGE = "It leaves your saved pieces. You can save it again wherever Mila shows it.";
const REMOVE_FAILED = "That didn't go through. Check your connection and try again.";

/**
 * Every recommended piece she saved, grouped by garment so "the jeans from
 * Tuesday's look" is one glance away. Single column: a piece is content, not a
 * tile.
 */
export function SavedPiecesScreen() {
  const insets = useSafeAreaInsets();
  const [confirmRemove, setConfirmRemove] = useState<SavedProduct | null>(null);

  const { data, isPending, isError, refetch, isRefetching } = useSavedProducts();
  const remove = useRemoveSavedProduct();

  if (isPending) {
    return (
      <Frame>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Loading your saved pieces"
          accessibilityState={{ busy: true }}
          className="gap-lg"
        >
          {[0, 1, 2].map((row) => (
            <View key={row} className="flex-row gap-lg">
              <Skeleton className="h-36 w-28" />
              <View className="flex-1 gap-sm">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </View>
            </View>
          ))}
        </View>
      </Frame>
    );
  }

  if (isError || !data) {
    return (
      <Frame>
        <View className="flex-1 justify-center">
          <ErrorState
            title="Your saved pieces didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        </View>
      </Frame>
    );
  }

  if (data.status === "unavailable") {
    // The saved-pieces table is not live yet. Not her problem, and not an error.
    return (
      <Frame>
        <View className="flex-1 justify-center">
          <EmptyState
            icon="bookmark"
            title="Saved pieces are almost here"
            description="Saving pieces isn't switched on yet. Check back soon."
            actionLabel="Go to Home"
            onAction={() => router.replace("/")}
          />
        </View>
      </Frame>
    );
  }

  if (data.items.length === 0) {
    return (
      <Frame>
        <View className="flex-1 justify-center">
          <EmptyState
            icon="bookmark"
            title="Nothing saved yet"
            description="Tap the bookmark on any piece Mila recommends and it waits here."
            actionLabel="Go to Home"
            onAction={() => router.replace("/")}
          />
        </View>
      </Frame>
    );
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <Heading />

      <SectionList
        sections={groupByGarment(data.items)}
        keyExtractor={(entry) => entry.item.id}
        stickySectionHeadersEnabled={false}
        // Third-party props that take style objects: case 1 of the exceptions.
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing["2xl"],
          gap: spacing.lg,
        }}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        renderSectionHeader={({ section }) => (
          <Text
            accessibilityRole="header"
            className="pt-md font-body-semibold text-section tracking-section uppercase text-muted"
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item: entry }) => (
          <SavedPieceCard
            item={entry.item}
            garment={entry.garment}
            onRemove={() => {
              remove.reset();
              setConfirmRemove(entry.item);
            }}
          />
        )}
        ListFooterComponent={
          <View className="pt-lg">
            <Button label="Back" variant="secondary" onPress={() => router.back()} />
          </View>
        }
      />

      <ConfirmSheet
        visible={Boolean(confirmRemove)}
        onClose={() => setConfirmRemove(null)}
        title="Remove this piece?"
        message={remove.isError ? REMOVE_FAILED : REMOVE_MESSAGE}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (!confirmRemove) return;
          remove.mutate(confirmRemove, { onSuccess: () => setConfirmRemove(null) });
        }}
      />
    </View>
  );
}

function Heading() {
  return (
    <View className="gap-xs px-xl pb-md pt-md">
      <Text accessibilityRole="header" className="font-display text-h1 tracking-heading text-ink">
        Saved pieces
      </Text>
      <Text className="font-body text-base text-body">
        The pieces Mila recommended that you kept for later.
      </Text>
    </View>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <Heading />
      <View className="flex-1 px-xl pb-2xl">{children}</View>
      <View className="px-xl pb-lg">
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}
