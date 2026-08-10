import { Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Divider } from "@/components/ui/Divider";
import type { DetailedColorProfile as StudioDossier } from "@/constants/style-profile";
import { studioToDossier } from "@/lib/style-profile/studio-dossier";
import type { Json, StudioColorProfile } from "@/types/models";

import { PaletteSwatches } from "../components/PaletteSwatches";
import { StepShell } from "../components/StepShell";
import type { SaveState } from "../components/SaveStatus";
import { undertoneForSeason } from "../machine";

export function ColorResult({
  candidate,
  existingDossier,
  onBack,
  onChooseAnother,
  onConfirmed,
  save,
  saveState,
  onRetrySave,
  saving,
}: {
  candidate: StudioColorProfile | null;
  existingDossier: StudioDossier | null;
  onBack: () => void;
  onChooseAnother: () => void;
  onConfirmed: () => void;
  save: (payload: {
    skin_undertone: string;
    color_season: string;
    color_profile: Json;
  }) => Promise<boolean>;
  saveState: SaveState;
  onRetrySave: () => void;
  saving: boolean;
}) {
  const dossier: StudioDossier | null = candidate
    ? studioToDossier(candidate, existingDossier ?? undefined)
    : existingDossier;

  if (!dossier) {
    return (
      <StepShell step="color-result" onBack={onBack}>
        <ErrorState
          title="No colour result yet"
          description="Choose a season on the previous step and Mila will build your palette."
          actionLabel="Choose a season"
          onAction={onChooseAnother}
          className="py-2xl"
        />
      </StepShell>
    );
  }

  async function handleConfirm() {
    if (!dossier) return;
    const ok = await save({
      skin_undertone: undertoneForSeason(dossier.season),
      color_season: dossier.season,
      color_profile: dossier as unknown as Json,
    });
    if (ok) onConfirmed();
  }

  return (
    <StepShell
      step="color-result"
      onBack={onBack}
      onContinue={handleConfirm}
      continueLabel="Use this profile"
      continueLoading={saving}
      saveState={saveState}
      onRetrySave={onRetrySave}
    >
      <View className="gap-xl">
        <Text className="font-body text-base text-body">
          This is what Mila will use to colour your recommendations — palette, undertone, and the
          colours to soften or avoid.
        </Text>

        <Card>
          <Text className="font-body-semibold text-label tracking-label uppercase text-accent">
            {dossier.season}
          </Text>
          <Text className="font-display text-h2 tracking-heading text-ink mt-xs">
            {dossier.subSeason}
          </Text>
          <View className="my-lg">
            <Divider />
          </View>
          <View className="gap-sm">
            {[
              ["Undertone", dossier.toneType],
              ["Lightness", dossier.brightness],
              ["Saturation", dossier.saturation],
              ["Contrast", dossier.contrastScale],
            ].map(([label, value]) => (
              <View key={label} className="flex-row justify-between gap-lg">
                <Text className="font-body text-sm text-muted">{label}</Text>
                <Text className="flex-1 font-body-medium text-sm text-ink text-right">{value}</Text>
              </View>
            ))}
          </View>
        </Card>

        <PaletteSwatches title="Your primary palette" swatches={dossier.primarySwatches} />
        <PaletteSwatches title="Supporting tones" swatches={dossier.secondarySwatches} />

        <View className="gap-md">
          <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
            Colours to soften
          </Text>
          {dossier.avoidColors.map((entry) => (
            <Text key={entry} className="font-body text-sm text-body">
              {entry}
            </Text>
          ))}
        </View>

        <Card>
          <Text className="font-body text-base text-body">{dossier.stylistNote}</Text>
        </Card>
      </View>
    </StepShell>
  );
}
