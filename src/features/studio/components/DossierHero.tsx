import { router } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import {
  SEASON_ONE_LINER,
  type Season,
  type DetailedColorProfile as StudioDossier,
} from "@/constants/style-profile";
import type { DashboardProfile } from "@/types/models";

import { AttributeDiagram } from "./AttributeDiagram";
import { DetailChip } from "./DetailChip";

/**
 * The top of the dossier: who she is, in one card.
 *
 * Colour is deliberately absent — the hero states the season and the eight
 * facts behind it, and "Your Palette" further down is the only place a colour
 * is named (§3.8). The chips carry the completion prompt too: an unset
 * attribute reads as "Add" and opens the step that sets it.
 */
export function DossierHero({
  profile,
  dossier,
  family,
  preferences,
}: {
  profile: DashboardProfile | undefined;
  dossier: StudioDossier | null;
  /** The four-family season, resolved by the screen. Null until she calibrates. */
  family: Season | null;
  preferences: string[];
}) {
  const hasSeason = dossier !== null || Boolean(profile?.color_season);

  // The tuned sub-season when there is a real reading, the plain season
  // otherwise, and nothing invented when neither exists yet.
  const seasonName =
    dossier?.subSeason || dossier?.season || profile?.color_season || "Season not set";
  const summary = hasSeason
    ? (dossier?.stylistNote ??
      (family ? SEASON_ONE_LINER[family] : "Every look below is composed against this palette."))
    : "Set your season and Mila builds your palette from it.";

  const monogram = (profile?.full_name?.trim() || "M")[0].toUpperCase();

  const chips = [
    { label: "Undertone", value: dossier?.toneType ?? profile?.skin_undertone },
    { label: "Skin lightness", value: dossier?.brightness },
    { label: "Contrast", value: dossier?.contrastScale },
    {
      label: "Silhouette",
      value: profile?.body_type,
      onPress: () => router.push("/dossier/body-type"),
      diagram: <AttributeDiagram kind="silhouette" value={profile?.body_type} />,
    },
    {
      label: "Face shape",
      value: profile?.face_shape,
      onPress: () => router.push("/dossier/face-shape"),
      diagram: <AttributeDiagram kind="face" value={profile?.face_shape} />,
    },
    {
      label: "Hair texture",
      value: profile?.hair_type,
      onPress: () => router.push("/dossier/hair-type"),
      diagram: <AttributeDiagram kind="hair" value={profile?.hair_type} />,
    },
    {
      label: "Beauty",
      value: preferences[0],
      onPress: () => router.push("/dossier/beauty-preferences"),
    },
    // ponytail: read-only. The web chip scrolls to the goal tray; here the tray
    // is already on this screen, and scroll-to would mean threading a ref
    // through the shared Screen layout for one chip.
    { label: "Style goal", value: profile?.style_goals?.[0] },
  ];

  return (
    <View className="gap-xl rounded-card border border-border bg-surface p-xl dark:border-border/12">
      <Text className="text-center font-body-semibold text-label tracking-label uppercase text-muted">
        Your personal season
      </Text>

      <View className="items-center gap-lg">
        <View className="rounded-pill border border-accent/50 p-sm">
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="h-3xl w-3xl items-center justify-center rounded-pill bg-ink"
          >
            <Text className="font-display text-h2 text-on-ink">{monogram}</Text>
          </View>
        </View>

        <View className="gap-sm">
          <Text
            accessibilityRole="header"
            className="text-center font-display text-h1 tracking-heading text-ink"
          >
            {seasonName}
          </Text>
          <Text className="text-center font-body text-base text-body">{summary}</Text>
        </View>
      </View>

      <View className="gap-sm">
        {chunk(chips, 2).map((row, index) => (
          <View key={row[0].label} className="flex-row gap-sm">
            {row.map((chip) => (
              <View key={chip.label} className="flex-1">
                <DetailChip {...chip} />
              </View>
            ))}
            {/* An odd final row keeps its chip at half width rather than
                stretching it across the grid. */}
            {row.length === 1 ? <View key={`spacer-${index}`} className="flex-1" /> : null}
          </View>
        ))}
      </View>

      {/* The one way into the season picker. Calibration is an input; it lives
          on its own screen instead of interrupting this one. */}
      <Button
        label={hasSeason ? "Change my season" : "Set my season"}
        variant="ghost"
        onPress={() => router.push("/dossier/color")}
      />
    </View>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
