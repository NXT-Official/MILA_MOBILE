import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { LookDetail } from "@/components/ui/LookDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDeleteOutfit, useOutfit } from "@/hooks/use-outfits";
import { lookSections, normalizeAnalysisResult } from "@/lib/outfit-history";
import { useConciergeStore } from "@/stores/concierge-store";
import { radii } from "@/theme/tokens";


/**
 * A saved look, deep-linkable at `/look/[id]`.
 *
 * The query is scoped to the signed-in member, so a link to someone else's look
 * resolves to "not found" rather than to their outfit — RLS enforces that at the
 * database, and the predicate here means the app never even asks.
 */
export function LookDetailScreen({ id }: { id: string }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: outfit, isPending, isError, refetch } = useOutfit(id);
  const remove = useDeleteOutfit();
  const anchor = useConciergeStore((s) => s.anchor);

  if (isPending) {
    return (
      <Screen scroll>
        <View className="gap-xl py-xl">
          <Skeleton className="aspect-[3/4] w-full rounded-card" />
          <LoadingState label="Loading this look" lines={4} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <ErrorState
            title="This look didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        </View>
      </Screen>
    );
  }

  if (!outfit) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <EmptyState
            icon="outfit"
            title="This look is gone"
            description="It may have been deleted, or it belongs to another account."
            actionLabel="Back to History"
            onAction={() => router.replace("/history")}
          />
        </View>
      </Screen>
    );
  }

  const entry = normalizeAnalysisResult(outfit.analysis_result);

  return (
    <Screen scroll>
      <View className="gap-xl py-xl">
        <Image
          source={{ uri: outfit.image_url }}
          // Case 1 of the StyleSheet exceptions: expo-image takes a style object.
          style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.card }}
          contentFit="cover"
          transition={200}
          accessibilityLabel="Saved look"
        />

        {entry.kind === "daily_look" ? (
          <>
            {entry.weather || entry.vibe ? (
              <Text className="font-body text-sm text-body">
                {[entry.vibe, entry.weather].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
            <LookDetail
              headline={entry.look.outfit.headline || "Saved look"}
              sections={lookSections(entry.look)}
              loading={false}
            />
          </>
        ) : entry.kind === "lens" ? (
          <View className="gap-md">
            <Text
              accessibilityRole="header"
              className="font-display text-h2 tracking-heading text-ink"
            >
              Lens analysis
            </Text>
            <Text className="font-body text-base text-body">{entry.analysis.verdict}</Text>
          </View>
        ) : (
          <Text className="font-body text-base text-body">
            The details for this one are no longer available, but the image is.
          </Text>
        )}

        <View className="gap-md">
          {/* Anchors the look, then opens the thread. The store carries it
              across the navigation; the server re-reads the look scoped to the
              caller and attaches its image (§6). */}
          <Button
            label="Ask Mila about this look"
            onPress={() => {
              anchor({
                id: outfit.id,
                imageUrl: outfit.image_url,
                headline:
                  entry.kind === "daily_look"
                    ? entry.look.outfit.headline || "Saved look"
                    : entry.kind === "lens"
                      ? "Lens analysis"
                      : "Saved look",
              });
              router.replace("/concierge");
            }}
          />
          <Button
            label="Delete this look"
            variant="secondary"
            onPress={() => setConfirmDelete(true)}
          />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>

      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this look?"
        message="It leaves your history for good. The credits it used are not returned."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(outfit.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              router.replace("/history");
            },
          })
        }
      />
    </Screen>
  );
}
