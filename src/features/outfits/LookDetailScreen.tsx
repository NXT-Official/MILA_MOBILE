import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { LookDetail } from "@/components/ui/LookDetail";
import { Skeleton } from "@/components/ui/Skeleton";
import { ShopThisLookGrid } from "@/features/dashboard/components/ShopThisLookGrid";
import { useDeleteOutfit, useOutfit } from "@/hooks/use-outfits";
import { lookSections, headlineSlug, normalizeAnalysisResult, outfitTitle } from "@/lib/outfit-history";
import { files } from "@/services/files";
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

  const title = outfitTitle(entry);

  // The web's detail dialog, in the same three sections and the same order —
  // empties dropped, so a sparse analysis renders what it has.
  const lensSections =
    entry.kind === "lens"
      ? [
          { title: "Stylist's Verdict", body: entry.analysis.verdict },
          { title: "Color Match", body: entry.analysis.color_match },
          { title: "Silhouette", body: entry.analysis.silhouette },
        ].filter((section) => section.body)
      : [];

  return (
    <Screen scroll>
      <View className="gap-xl py-xl">
        <View>
          <Image
            source={{ uri: outfit.image_url }}
            // Case 1 of the StyleSheet exceptions: expo-image takes a style object.
            style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.card }}
            contentFit="cover"
            transition={200}
            accessibilityLabel="Saved look"
          />
          {/* The web's Download button, as the share sheet: the image is
              already in storage, so it is downloaded and handed over rather
              than re-encoded. Remounted on every render is fine — it is a
              press target, not state. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save or share this look"
            onPress={() =>
              void files.saveAndShareRemoteImage({
                filename: `mila-look-${headlineSlug(title)}.jpg`,
                url: outfit.image_url,
              })
            }
            hitSlop={8}
            className="absolute right-md top-md min-h-tap min-w-tap items-center justify-center rounded-pill border border-border bg-canvas/90 dark:border-border/12"
          >
            <Icon name="download" size="sm" color="ink" />
          </Pressable>
        </View>

        <Text className="font-body text-micro tracking-label-xwide uppercase text-muted">
          {new Date(outfit.created_at).toLocaleString()}
        </Text>

        {entry.kind === "daily_look" ? (
          <>
            {entry.vibe || entry.look.vibe_alignment_score != null || entry.weather ? (
              // The web's one-line pill: vibe, then the fit score, then the
              // weather she generated against.
              <View className="flex-row flex-wrap items-center gap-sm self-start rounded-pill border border-border bg-surface px-md py-xs dark:border-border/12">
                {entry.vibe ? (
                  <Text className="font-body text-micro tracking-label uppercase text-muted">
                    {entry.vibe}
                  </Text>
                ) : null}
                {entry.look.vibe_alignment_score != null ? (
                  <Text className="font-body-semibold text-micro tracking-label uppercase text-ink">
                    Vibe fit {entry.look.vibe_alignment_score}/10
                  </Text>
                ) : null}
                {entry.weather ? (
                  <Text className="font-body text-micro tracking-label uppercase text-muted">
                    {entry.weather}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <LookDetail
              headline={title}
              sections={lookSections(entry.look)}
              loading={false}
            />
            {/* The suggested items saved with the look — the same grid the
                dashboard shows. Absent for rows saved before the field
                existed; an empty array renders the grid's own empty copy. */}
            {entry.look.shoppable_picks ? (
              <ShopThisLookGrid items={entry.look.shoppable_picks} />
            ) : null}
          </>
        ) : entry.kind === "lens" ? (
          <LookDetail headline="Lens analysis" sections={lensSections} loading={false} />
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
                headline: title,
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
