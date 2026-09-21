import { Pressable, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Icon } from "@/components/ui/Icon";
import { HUBS } from "@/constants/climate";
import type { OnboardingStepId } from "@/constants/steps";
import type { DetailedColorProfile as StudioDossier } from "@/constants/style-profile";
import { normalizeBeautyPreferences } from "@/lib/beauty-preferences";
import { tagList } from "@/lib/profile-tags";
import type { DashboardProfile } from "@/types/models";

import { StepShell } from "../components/StepShell";

function Row({
  title,
  value,
  onEdit,
}: {
  title: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <View className="flex-row items-start justify-between gap-lg py-lg">
      <View className="flex-1 gap-xs">
        <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
          {title}
        </Text>
        <Text className="font-body text-base text-ink">{value}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${title.toLowerCase()}`}
        onPress={onEdit}
        hitSlop={12}
        className="min-h-tap justify-center"
      >
        <Text className="font-body-medium text-sm text-ink underline">Edit</Text>
      </Pressable>
    </View>
  );
}

function formatMeasurements(heightCm: number | null, weightKg: number | null): string {
  if (heightCm == null && weightKg == null) return "Not set — optional";
  const parts: string[] = [];
  if (heightCm != null) parts.push(`${heightCm} cm`);
  if (weightKg != null) parts.push(`${weightKg} kg`);
  return parts.join(" · ");
}

export function Review({
  profile,
  dossier,
  onBack,
  onEdit,
  onComplete,
  completing,
  completionError,
}: {
  profile: DashboardProfile;
  dossier: StudioDossier | null;
  onBack: () => void;
  onEdit: (step: OnboardingStepId) => void;
  onComplete: () => void;
  completing: boolean;
  completionError: string | null;
}) {
  const hub = HUBS.find((h) => h.id === profile.default_location);
  const beautyPrefs = normalizeBeautyPreferences(profile.beauty_preferences);
  const shoppingPrefs = tagList(profile.shopping_preferences);
  const stylingConstraints = tagList(profile.styling_constraints);
  const makeupEligible = profile.gender !== "Male";

  const rows: { title: string; value: string; step: OnboardingStepId }[] = [
    {
      title: "Colour profile",
      value: dossier ? `${dossier.subSeason} · ${dossier.season}` : "Not set",
      step: "color-result",
    },
    { title: "Skin undertone", value: profile.skin_undertone ?? "Not set", step: "color-result" },
    { title: "Gender", value: profile.gender ?? "Not set", step: "gender" },
    { title: "Skin depth", value: profile.skin_depth ?? "Not set", step: "skin-depth" },
    { title: "Body silhouette", value: profile.body_type ?? "Not set", step: "body-type" },
    {
      title: "Measurements",
      value: formatMeasurements(profile.height_cm, profile.weight_kg),
      step: "measurements",
    },
    { title: "Face shape", value: profile.face_shape ?? "Not set", step: "face-shape" },
    { title: "Hair type", value: profile.hair_type ?? "Not set", step: "hair-type" },
    { title: "Hair length", value: profile.hair_length ?? "Not set", step: "hair-length" },
    ...(makeupEligible
      ? [
          {
            title: "Makeup preference",
            value: profile.makeup_preference ?? "none",
            step: "makeup-preference" as OnboardingStepId,
          },
        ]
      : []),
    {
      title: "Beauty preferences",
      value: beautyPrefs.length > 0 ? beautyPrefs.join(", ") : "No preference selected",
      step: "beauty-preferences",
    },
    {
      title: "Location",
      value: hub ? `${hub.city} — ${hub.tagline}` : "Not set",
      step: "location",
    },
    {
      title: "Shopping preferences",
      value: shoppingPrefs.length > 0 ? shoppingPrefs.join(", ") : "No preference selected",
      step: "shopping-preferences",
    },
    {
      title: "Styling constraints",
      value:
        stylingConstraints.length > 0 ? stylingConstraints.join(", ") : "No constraints selected",
      step: "styling-constraints",
    },
  ];

  return (
    <StepShell
      step="review"
      onBack={onBack}
      onContinue={onComplete}
      continueLabel="Enter Mila"
      continueLoading={completing}
    >
      <View className="gap-lg">
        <Card>
          <View className="flex-row items-start gap-md">
            <View className="mt-xs">
              <Icon name="sparkle" size="sm" color="accent" />
            </View>
            <View className="flex-1 gap-xs">
              <Text className="font-body-medium text-base text-ink">
                Your Mila profile is ready
              </Text>
              <Text className="font-body text-sm text-body">
                Review what Mila will use to personalise your daily looks. You can update any of it
                later.
              </Text>
            </View>
          </View>
        </Card>

        <View>
          {rows.map((row, i) => (
            <View key={row.title}>
              {i > 0 ? <Divider /> : null}
              <Row title={row.title} value={row.value} onEdit={() => onEdit(row.step)} />
            </View>
          ))}
        </View>

        {completionError ? (
          <Text accessibilityLiveRegion="assertive" className="font-body text-sm text-destructive">
            {completionError}
          </Text>
        ) : null}
      </View>
    </StepShell>
  );
}
