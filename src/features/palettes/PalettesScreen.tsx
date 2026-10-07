import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDeleteSavedPalette, useSavedPalettes } from "@/hooks/use-saved-palettes";
import { spacing } from "@/theme/tokens";

import { PaletteCard } from "./components/PaletteCard";

/** Every pinned palette, newest first. Single column — a palette is content, not a tile. */
export function PalettesScreen() {
  const insets = useSafeAreaInsets();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: palettes, isPending, isError, refetch, isRefetching } = useSavedPalettes();
  const remove = useDeleteSavedPalette();

  if (isPending) {
    return (
      <Frame>
        <View className="gap-lg">
          <Skeleton className="h-3xl w-full rounded-card" />
          <Skeleton className="h-3xl w-full rounded-card" />
        </View>
      </Frame>
    );
  }

  if (isError) {
    return (
      <Frame>
        <View className="flex-1 justify-center">
          <ErrorState
            title="Your palettes didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        </View>
      </Frame>
    );
  }

  if (!palettes || palettes.length === 0) {
    return (
      <Frame>
        <View className="flex-1 justify-center">
          <EmptyState
            icon="studio"
            title="No palettes pinned"
            description="Make today's palette from your own colours and pin it here."
            actionLabel="Make today's palette"
            onAction={() => router.replace("/")}
          />
        </View>
      </Frame>
    );
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <View className="gap-xs px-xl pb-md pt-md">
        <Text accessibilityRole="header" className="font-display text-h1 tracking-heading text-ink">
          Saved palettes
        </Text>
        <Text className="font-body text-base text-body">
          Every daily mix you&apos;ve pinned, ready to wear again.
        </Text>
      </View>

      <FlatList
        data={palettes}
        keyExtractor={(item) => item.id}
        // Third-party props that take style objects — case 1 of the exceptions.
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing["2xl"],
          gap: spacing.lg,
        }}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListFooterComponent={
          <View className="pt-lg">
            <Button label="Back" variant="secondary" onPress={() => router.back()} />
          </View>
        }
        renderItem={({ item }) => (
          <PaletteCard
            saved={item}
            deleting={remove.isPending && confirmDelete === item.id}
            onDelete={() => setConfirmDelete(item.id)}
          />
        )}
      />

      <ConfirmSheet
        visible={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Remove this palette?"
        message="It leaves your saved palettes. You can always pin it again from Home."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (!confirmDelete) return;
          remove.mutate(confirmDelete, { onSuccess: () => setConfirmDelete(null) });
        }}
      />
    </View>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas px-xl" style={{ paddingTop: insets.top }}>
      <View className="gap-xs pb-lg pt-md">
        <Text accessibilityRole="header" className="font-display text-h1 tracking-heading text-ink">
          Saved palettes
        </Text>
        <Text className="font-body text-base text-body">
          Every daily mix you&apos;ve pinned, ready to wear again.
        </Text>
      </View>
      <View className="flex-1 pb-2xl">{children}</View>
      <View className="pb-lg">
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}
