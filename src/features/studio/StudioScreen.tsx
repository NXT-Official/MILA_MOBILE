import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  ATELIER_PROVENANCE,
  HAIR_DIRECTION,
  MAKEUP_HARMONY,
  SILHOUETTE_STRATEGY,
  TEXTILE_DIRECTION,
} from "@/constants/style-profile";
import { useProfile } from "@/hooks/use-profile";
import { useSavedPalettes } from "@/hooks/use-saved-palettes";
import { normalizeBeautyPreferences } from "@/lib/beauty-preferences";
import { matrixForSubSeason } from "@/lib/style-profile";
import { combosFor } from "@/lib/style-profile/outfit-combos";
import { normalizeStoredProfile } from "@/lib/style-profile/studio-dossier";

import { ComboCard } from "./components/ComboCard";
import { DossierHero } from "./components/DossierHero";
import { DossierRow } from "./components/DossierRow";
import { PaletteStrip } from "./components/PaletteStrip";
import { SeasonPalette } from "./components/SeasonPalette";
import { StyleGoalsTray } from "./components/StyleGoalsTray";
import { StylingNoteCard } from "./components/StylingNoteCard";
import { resolveSeasonFamily } from "./season";

/**
 * The style dossier, in the §3 order: hero, Silhouette, Face shape, Hair,
 * Beauty preferences, Saved palettes, then "Retake analysis".
 *
 * Every row re-enters the step that set it. There is no second set of editors
 * here — the rows navigate to `/dossier/[field]`, which mounts the same
 * onboarding step components in an edit shell.
 */
export function StudioScreen() {
  const { data: profile, isPending, isError, refetch } = useProfile();
  const palettes = useSavedPalettes();

  if (isPending) {
    return (
      <Screen scroll>
        <View className="gap-xl py-xl">
          <Skeleton className="h-2xl w-2/3" />
          <View className="flex-row gap-md">
            <Skeleton className="h-tile w-tile rounded-panel" />
            <Skeleton className="h-tile w-tile rounded-panel" />
            <Skeleton className="h-tile w-tile rounded-panel" />
          </View>
          <LoadingState label="Loading your dossier" lines={4} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <ErrorState
            title="Your dossier didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        </View>
      </Screen>
    );
  }

  const dossier = normalizeStoredProfile(profile?.color_profile);
  const preferences = normalizeBeautyPreferences(profile?.beauty_preferences);

  // The four-family palette the combos and the palette-derived notes read from.
  const family = resolveSeasonFamily(profile?.color_season_base, dossier);
  const combos = family ? combosFor(family) : [];

  // The archive grid. The stored full palette wins; the sub-season matrix is
  // the fallback for a legacy dossier that never persisted one.
  const fullPalette = family
    ? (dossier?.fullPalette ??
      matrixForSubSeason(family, dossier?.subSeason ?? ""))
    : [];

  // Resolved before the JSX so the "add it" action is gated on there being no
  // directive, not on the column being empty: an off-taxonomy `body_type` would
  // otherwise show the fallback copy with no way to act on it.
  const silhouette = profile?.body_type
    ? SILHOUETTE_STRATEGY[profile.body_type]
    : undefined;
  const hair = profile?.hair_type
    ? HAIR_DIRECTION[profile.hair_type]
    : undefined;

  return (
    <Screen scroll edges={{ top: true, bottom: false }}>
      <View className="gap-xl pb-2xl pt-lg">
        <View className="flex-row items-center justify-between gap-md">
          <Text
            accessibilityRole="header"
            className="font-display text-h1 tracking-heading text-ink"
          >
            Studio
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
            className="active:opacity-60 h-tap w-tap items-center justify-center"
          >
            <Icon name="settings" size="md" color="ink" />
          </Pressable>
        </View>

        {dossier ? (
          <DossierHero dossier={dossier} />
        ) : (
          <EmptyState
            icon="studio"
            title="No colour reading yet"
            description="Mila reads your season from a photo, or you can pick it yourself."
            actionLabel="Read my colouring"
            onAction={() => router.push("/dossier/color")}
          />
        )}

        <View className="overflow-hidden rounded-panel border border-border bg-surface dark:border-border/12">
          <DossierRow
            label="Silhouette"
            value={profile?.body_type ?? null}
            onPress={() => router.push("/dossier/body-type")}
          />
          <DossierRow
            label="Face shape"
            value={profile?.face_shape ?? null}
            onPress={() => router.push("/dossier/face-shape")}
          />
          <DossierRow
            label="Hair"
            value={profile?.hair_type ?? null}
            onPress={() => router.push("/dossier/hair-type")}
          />
          <DossierRow
            label="Beauty preferences"
            // Optional in onboarding, so an empty list is a normal state and
            // reads as "Not set" rather than as an empty row.
            value={preferences.length > 0 ? preferences.join(" · ") : null}
            onPress={() => router.push("/dossier/beauty-preferences")}
          />
        </View>

        {family ? (
          <>
            <SeasonPalette season={family} fullPalette={fullPalette} />
            {/* The Studio tab reads this same palette, so the shortcut only
                exists once there is a season to preview. */}
            <Button
              label="Try looks on yourself"
              variant="secondary"
              icon="sparkle"
              onPress={() => router.navigate("/studio")}
            />
          </>
        ) : null}

        {combos.length > 0 ? (
          <View className="gap-md">
            <Text
              accessibilityRole="header"
              className="font-body-semibold text-section tracking-section uppercase text-muted"
            >
              Colour combinations to try
            </Text>
            {combos.map((combo) => (
              <ComboCard key={combo.id} combo={combo} />
            ))}
          </View>
        ) : null}

        {/* Actions, not colour names — the hero already states the season. */}
        <View className="gap-md">
          <View className="gap-xs">
            <Text
              accessibilityRole="header"
              className="font-body-semibold text-section tracking-section uppercase text-muted"
            >
              Mila&apos;s styling notes
            </Text>
            {/* Credits the source rather than renaming the season, which the
                hero already states once. Only when there is a real reading. */}
            {dossier ? (
              <Text className="font-body text-sm text-body">
                {ATELIER_PROVENANCE}
              </Text>
            ) : null}
          </View>

          <StylingNoteCard
            title="Silhouette strategy"
            directive={silhouette}
            rationale={{ label: "silhouette", value: profile?.body_type }}
            fallback="Add your silhouette and this becomes specific to your proportions."
            action={
              silhouette
                ? undefined
                : {
                    label: "Add silhouette",
                    onPress: () => router.push("/dossier/body-type"),
                  }
            }
          />

          <StylingNoteCard
            title="Hair direction"
            directive={hair}
            rationale={{ label: "hair texture", value: profile?.hair_type }}
            fallback="Add your hair texture to unlock this."
            action={
              hair
                ? undefined
                : {
                    label: "Add hair texture",
                    onPress: () => router.push("/dossier/hair-type"),
                  }
            }
          />

          {family ? (
            <>
              <StylingNoteCard
                title="Makeup harmony"
                directive={MAKEUP_HARMONY[family]}
                rationale={{ label: "palette" }}
              />
              <StylingNoteCard
                title="Textile direction"
                directive={TEXTILE_DIRECTION[family]}
                rationale={{ label: "palette" }}
              />
            </>
          ) : null}
        </View>

        <StyleGoalsTray value={profile?.style_goals ?? []} />

        <View className="gap-md">
          <Text
            accessibilityRole="header"
            className="font-body-semibold text-section tracking-section uppercase text-muted"
          >
            Saved palettes
          </Text>
          <PaletteStrip
            palettes={palettes.data ?? []}
            loading={palettes.isPending}
          />
          {palettes.data?.length ? (
            <Button
              label="See all palettes"
              variant="ghost"
              onPress={() => router.push("/palettes")}
            />
          ) : null}
        </View>

        {/* Last, and deliberately understated: re-reading her colouring replaces
            the dossier every other screen is built on. */}
        <Button
          label="Retake colour analysis"
          variant="secondary"
          onPress={() => router.push("/dossier/color")}
        />
      </View>
    </Screen>
  );
}
