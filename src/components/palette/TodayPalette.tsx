import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppState } from "@/hooks/use-app-state";
import { useProfile } from "@/hooks/use-profile";
import {
  useDeleteSavedPalette,
  useSavePalette,
  useSavedPalettes,
} from "@/hooks/use-saved-palettes";
import {
  RECENT_TRIOS,
  buildDailyPalette,
  localDateKey,
  paletteForKey,
  paletteSeed,
  pushRecent,
  trioKey,
} from "@/lib/color-analysis/daily-palette";
import { memberSwatches } from "@/lib/color-analysis/member-swatches";
import { generateDailyPalette, type DailyPalette } from "@/lib/color-analysis/paletteGenerator";
import type { SeasonId } from "@/lib/color-analysis/types";
import { paletteInsight, paletteSwatches, paletteVibe } from "@/lib/saved-palette";
import { useAuthStore } from "@/stores/auth-store";
import {
  initialPaletteState,
  recordShown,
  usePaletteRecentStore,
  type PaletteState,
} from "@/stores/palette-recent-store";

const hexesOf = (p: Pick<DailyPalette, "baseHex" | "statementHex" | "accentHex">) => [
  p.baseHex,
  p.statementHex,
  p.accentHex,
];

const announcement = (p: DailyPalette) =>
  `New palette: ${p.baseColor}, ${p.statementColor} and ${p.accentColor}.`;

/** The state this card is showing, tied to the member and day it was read for. */
type Snapshot = { userId: string; dateKey: string; state: PaletteState };

/** Milliseconds from `now` to one second past the next local midnight. */
function untilNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

/**
 * Today's palette from her own colours: three of her swatches, with where to
 * wear each (base on bottoms or a jacket, statement on top near her face,
 * accent on shoes, bag or jewellery). It skips her last five trios, so a
 * shuffle never repeats one. Without a colour read it keeps the curated mixes
 * and says how to get her own.
 *
 * `startFresh` (a check-in just changed her) opens on the next pick: it keeps
 * what this device remembers and excludes the trio that was on screen.
 *
 * Every swatch is named and carries its wear line, so nothing is told by colour
 * alone. Not Home: Home switches over to this card later.
 */
export function TodayPalette({
  seasonId,
  startFresh = false,
}: {
  seasonId: SeasonId;
  startFresh?: boolean;
}) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const profile = useProfile();
  const loadingProfile = Boolean(userId) && profile.isPending;
  const profileFailed = Boolean(userId) && profile.isError && !profile.data;
  const hasRead = !profile.isPending && !profileFailed;
  const swatches = memberSwatches(profile.data?.color_profile);
  const fromOwnColours = swatches.length >= 3;

  const saved = useSavedPalettes();
  const save = useSavePalette();
  const remove = useDeleteSavedPalette();

  // The local day. Re-read when she comes back to the app and at the next
  // midnight, so a card left open overnight starts the new day's palette.
  const [todayKey, setTodayKey] = useState(() => localDateKey(new Date()));
  useAppState(() => setTodayKey(localDateKey(new Date())));
  useEffect(() => {
    const timer = setTimeout(() => setTodayKey(localDateKey(new Date())), untilNextDay(new Date()));
    return () => clearTimeout(timer);
  }, [todayKey]);

  // Nothing is read or written until the persisted store has loaded: an early
  // write would replace the history it is about to load.
  const [hydrated, setHydrated] = useState(() => usePaletteRecentStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return undefined;
    return usePaletteRecentStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  const readStored = usePaletteRecentStore((s) => s.read);
  const saveStored = usePaletteRecentStore((s) => s.save);

  // Read once per member and day, then held here: the store is written as she
  // shuffles, and re-reading it would apply `startFresh` again every time.
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const current =
    snapshot && snapshot.userId === userId && snapshot.dateKey === todayKey
      ? snapshot.state
      : null;
  if (hydrated && userId && !current) {
    // Adjusting state while rendering, guarded so it settles in one pass.
    // src: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes · React 19.2
    setSnapshot({
      userId,
      dateKey: todayKey,
      state: initialPaletteState(readStored(userId, todayKey), startFresh),
    });
  }

  const [curated, setCurated] = useState(() => generateDailyPalette(seasonId));
  const [mixCount, setMixCount] = useState(1);

  // The trio on screen is the one recorded as shown, so reopening shows it again.
  const ownPalette =
    current && userId && fromOwnColours
      ? ((current.shown ? paletteForKey({ swatches, key: current.shown }) : null) ??
        buildDailyPalette({
          swatches,
          seed: paletteSeed(userId, current.dateKey, current.attempt),
          recent: current.recent,
        }))
      : null;
  const look = ownPalette ?? curated;

  // Record today's pick in the store the moment it is shown, so tomorrow cannot
  // repeat it. The store is the external system here; this card's own state
  // already holds the pick, so nothing is set.
  const ownKey = ownPalette ? trioKey(hexesOf(ownPalette)) : null;
  useEffect(() => {
    if (!userId || !current || !ownKey || current.shown === ownKey) return;
    saveStored(userId, recordShown(current, ownKey));
  }, [userId, current, ownKey, saveStored]);

  const settling = fromOwnColours && !current;

  function shuffle() {
    setMixCount((count) => count + 1);

    // Her own colours: skip the last five trios, so a shuffle never repeats one.
    if (userId && current && ownPalette) {
      const prior = pushRecent(current.recent, trioKey(hexesOf(ownPalette)), RECENT_TRIOS);
      const attempt = current.attempt + 1;
      const next = buildDailyPalette({
        swatches,
        seed: paletteSeed(userId, current.dateKey, attempt),
        recent: prior,
      });
      if (next) {
        const recorded = recordShown(
          { dateKey: current.dateKey, attempt, recent: prior },
          trioKey(hexesOf(next)),
        );
        setSnapshot({ userId, dateKey: current.dateKey, state: recorded });
        saveStored(userId, recorded);
        AccessibilityInfo.announceForAccessibility(announcement(next));
        return;
      }
    }

    const following = generateDailyPalette(seasonId);
    setCurated(following);
    AccessibilityInfo.announceForAccessibility(announcement(following));
  }

  // The pin lives in her saved collection, matched on the three hexes (the
  // server's unique index keys on the same), so it reads as pinned across devices.
  const savedRow = saved.data?.find(
    (row) =>
      row.palette.baseHex === look.baseHex &&
      row.palette.statementHex === look.statementHex &&
      row.palette.accentHex === look.accentHex,
  );
  const isSaved = Boolean(savedRow);
  const savedCount = saved.data?.length ?? 0;
  const pending = save.isPending || remove.isPending;

  function toggleSaved() {
    if (savedRow) remove.mutate(savedRow.id);
    else save.mutate(look);
  }

  const today = new Date(`${todayKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <View className="gap-lg rounded-card border border-border bg-surface p-lg dark:border-border/12">
      <View className="flex-row items-start justify-between gap-md">
        <View className="gap-sm">
          <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
            {today}
          </Text>
          {profileFailed || loadingProfile || settling ? null : (
            <View className="self-start rounded-pill bg-accent-soft px-md py-xs">
              <Text className="font-body-semibold text-label tracking-label uppercase text-ink">
                {paletteVibe(look)}
              </Text>
            </View>
          )}
        </View>
        <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
          Mix {String(mixCount).padStart(2, "0")}
        </Text>
      </View>

      {profileFailed ? (
        <View className="items-center gap-md">
          <Icon name="alert" size="lg" color="muted" />
          <Text className="text-center font-body text-base text-ink">
            We couldn&apos;t load your colours. Try again.
          </Text>
          <Button label="Try again" variant="secondary" onPress={() => void profile.refetch()} />
        </View>
      ) : loadingProfile || settling ? (
        <View accessible accessibilityLabel="Loading your colours" className="gap-sm">
          {[0, 1, 2].map((slot) => (
            <View
              key={slot}
              className="flex-row items-center gap-md rounded-panel border border-border p-md dark:border-border/12"
            >
              <Skeleton className="h-2xl w-2xl rounded-pill" />
              <View className="flex-1 gap-xs">
                <Skeleton className="h-3 w-1/4 rounded-pill" />
                <Skeleton className="h-4 w-1/2 rounded-pill" />
                <Skeleton className="h-3 w-2/3 rounded-pill" />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="gap-sm">
          {paletteSwatches(look).map((swatch) => (
            <View
              key={swatch.role}
              className="flex-row items-center gap-md rounded-panel border border-border p-md dark:border-border/12"
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                // The swatch colour is member data, not a theme token. Case 1 of
                // the StyleSheet exceptions.
                style={{ backgroundColor: swatch.hex }}
                className="h-2xl w-2xl rounded-pill border border-border dark:border-border/12"
              />
              <View className="flex-1 gap-xs">
                <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
                  {swatch.role}
                </Text>
                <Text className="font-body-medium text-sm text-ink">{swatch.name}</Text>
                <Text className="font-body text-micro text-body">{swatch.wear}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {profileFailed || loadingProfile || settling ? null : (
        <View
          accessibilityLiveRegion="polite"
          className="flex-row items-start gap-sm rounded-panel border border-accent bg-accent-soft p-md"
        >
          <View className="mt-xs">
            <Icon name="sparkle" size="xs" color="ink" />
          </View>
          <Text className="flex-1 font-body text-sm text-body">
            <Text className="font-body-semibold text-ink">Mila&apos;s take: </Text>
            {look.isSisterSeasonIncluded
              ? "I borrowed the accent from your Sister Season for a little range without leaving your palette."
              : paletteInsight(look)}
          </Text>
        </View>
      )}

      {hasRead && !fromOwnColours ? (
        <View className="gap-sm">
          <Text className="font-body text-sm text-body">
            Palettes from your own colours start after your colour read.
          </Text>
          <Button
            label="Read my colours"
            variant="secondary"
            onPress={() => router.push("/dossier/color")}
          />
        </View>
      ) : null}

      {save.isError || remove.isError ? (
        <InlineError message="That didn't save. Check your connection and try again." />
      ) : null}

      {profileFailed ? null : (
        <View className="flex-row items-center gap-md">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSaved, disabled: pending }}
            accessibilityLabel={isSaved ? "Remove this palette from saved" : "Save this palette"}
            disabled={pending}
            onPress={toggleSaved}
            className={
              isSaved
                ? "active:opacity-90 h-12 w-12 items-center justify-center rounded-control bg-ink"
                : "active:opacity-90 h-12 w-12 items-center justify-center rounded-control border border-border dark:border-border/12"
            }
          >
            {/* Saved is carried by the shape, the fill and the label, never by hue alone. */}
            <Icon name={isSaved ? "bookmarkCheck" : "bookmark"} size="sm" color={isSaved ? "onInk" : "ink"} />
          </Pressable>

          <Button
            label="Shuffle palette"
            icon="retry"
            disabled={loadingProfile || settling}
            onPress={shuffle}
            className="flex-1"
          />
        </View>
      )}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={savedCount > 0 ? `View ${savedCount} saved palettes` : "View saved palettes"}
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
