import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import {
  useDeleteSavedPalette,
  useSavePalette,
  useSavedPalettes,
} from "@/hooks/use-saved-palettes";
import { generateDailyPalette } from "@/lib/color-analysis/paletteGenerator";
import type { SeasonId } from "@/lib/color-analysis/types";
import { paletteSwatches } from "@/lib/saved-palette";

/**
 * Three colours to build today around, and the controls to reroll or pin them.
 *
 * Every swatch is named. The Colour-Is-Content rule is at its strictest here
 * (§11): the hex *is* the data, so a member who cannot separate the three
 * circles still reads "Sage Mist, Bone Ecru, Soft Coral" and loses nothing.
 *
 * Generated once per mount rather than per render — `generateDailyPalette` is
 * random, and a palette that reshuffles when an unrelated query settles is not
 * a daily palette.
 *
 * Saved state is read from the server list rather than held locally: the pin
 * lives in her collection, so a palette pinned on the web reads as pinned here.
 */
export function DailyPaletteGenerator({ seasonId }: { seasonId: SeasonId }) {
  const [palette, setPalette] = useState(() => generateDailyPalette(seasonId));
  const [mixCount, setMixCount] = useState(1);

  const saved = useSavedPalettes();
  const save = useSavePalette();
  const remove = useDeleteSavedPalette();

  // Matched on the three hexes, which is also what the server's unique index
  // keys on — the same palette identity on both sides.
  const savedRow = saved.data?.find(
    (row) =>
      row.palette.baseHex === palette.baseHex &&
      row.palette.statementHex === palette.statementHex &&
      row.palette.accentHex === palette.accentHex,
  );
  const isSaved = Boolean(savedRow);
  const savedCount = saved.data?.length ?? 0;
  const pending = save.isPending || remove.isPending;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  function shuffle() {
    setPalette(generateDailyPalette(seasonId));
    setMixCount((count) => count + 1);
  }

  function toggleSaved() {
    if (savedRow) remove.mutate(savedRow.id);
    else save.mutate(palette);
  }

  return (
    <View className="gap-lg rounded-card border border-border bg-surface p-lg dark:border-border/12">
      <View className="flex-row items-start justify-between gap-md">
        <View className="gap-sm">
          <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
            {today}
          </Text>
          <View className="rounded-pill bg-accent-soft px-md py-xs">
            <Text className="font-body-semibold text-label tracking-label uppercase text-ink">
              {palette.styleVibe}
            </Text>
          </View>
        </View>
        <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
          Mix {String(mixCount).padStart(2, "0")}
        </Text>
      </View>

      <View className="gap-sm">
        {paletteSwatches(palette).map((swatch) => (
          <View
            key={swatch.hex}
            className="flex-1 items-center gap-sm rounded-panel border border-border p-md dark:border-border/12"
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              // The swatch colour is member data, not a theme token — it cannot
              // come from a class. Case 1 of the StyleSheet exceptions.
              style={{ backgroundColor: swatch.hex }}
              className="h-2xl w-2xl rounded-pill border border-border dark:border-border/12"
            />
            <View className="items-center gap-xs">
              <Text className="text-center font-body-semibold text-label tracking-label uppercase text-muted">
                {swatch.role}
              </Text>
              <Text className="text-center font-body-medium text-sm text-ink">
                {swatch.name}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View className="flex-row items-start gap-sm rounded-panel border border-accent bg-accent-soft p-md">
        <View className="mt-xs">
          <Icon name="sparkle" size="xs" color="ink" />
        </View>
        <Text className="flex-1 font-body text-sm text-body">
          <Text className="font-body-semibold text-ink">
            Mila&apos;s take —{" "}
          </Text>
          {palette.isSisterSeasonIncluded
            ? "I borrowed the accent from your Sister Season for a little range without leaving your palette."
            : palette.insight}
        </Text>
      </View>

      {save.isError || remove.isError ? (
        <InlineError message="That didn't save. Check your connection and try again." />
      ) : null}

      <View className="flex-row items-center gap-md">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isSaved, disabled: pending }}
          accessibilityLabel={
            isSaved ? "Remove this palette from saved" : "Save this palette"
          }
          disabled={pending}
          onPress={toggleSaved}
          className={
            isSaved
              ? "active:opacity-90 h-12 w-12 items-center justify-center rounded-control bg-ink"
              : "active:opacity-90 h-12 w-12 items-center justify-center rounded-control border border-border dark:border-border/12"
          }
        >
          {/* Saved is carried by the fill AND the ground, never by hue alone. */}
          <Icon name="bookmark" size="sm" color={isSaved ? "onInk" : "ink"} />
        </Pressable>

        <Button
          label="Generate"
          icon="retry"
          onPress={shuffle}
          className="flex-1"
        />
      </View>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={
          savedCount > 0
            ? `View ${savedCount} saved palettes`
            : "View saved palettes"
        }
        onPress={() => router.push("/palettes")}
        className="active:opacity-60 min-h-tap flex-row items-center justify-center gap-sm"
      >
        <Icon name="bookmark" size="xs" color="muted" />
        <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
          {savedCount > 0
            ? `View ${savedCount} saved palette${savedCount === 1 ? "" : "s"}`
            : "View saved palettes"}
        </Text>
      </Pressable>
    </View>
  );
}
