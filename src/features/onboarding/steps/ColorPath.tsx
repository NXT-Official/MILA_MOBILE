import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  KNOWN_SEASON_GROUPS,
  SEASONS_MASTER_DATA,
  SEASON_HEX_MATRIX,
  type DetailedColorProfile as StudioDossier,
} from "@/constants/style-profile";
import type { StudioColorProfile } from "@/types/models";

import { OptionTile } from "../components/OptionTile";
import { PersonalColorCapture } from "../components/PersonalColorCapture";
import { StepShell } from "../components/StepShell";

/**
 * COPIED from the web's `color-path-step.tsx`. Builds the candidate dossier
 * from the atelier's own season library rather than deriving anything — every
 * swatch, beauty note, and avoid-colour comes from `SEASONS_MASTER_DATA`.
 */
function knownTileToCandidate(
  key: keyof typeof SEASONS_MASTER_DATA,
  label: string,
  prev: StudioDossier | null,
): StudioColorProfile {
  const spec = SEASONS_MASTER_DATA[key];
  return {
    ...spec,
    faceShape: prev?.faceShape ?? "Oval Frame",
    bodyType: prev?.bodyType ?? "Hourglass",
    stylistNote: `Chosen by hand · ${label}. Every swatch, beauty note, and colour to avoid below is drawn straight from the atelier's ${spec.subSeason} library.`,
    fullPalette: SEASON_HEX_MATRIX[key],
    detectedLighting: "Manual Studio Calibration",
    calculatedUndertone: spec.toneType,
    confidenceScore: 100,
  } as StudioColorProfile;
}

const ALL_TILES = KNOWN_SEASON_GROUPS.flatMap((g) => g.tiles);

/**
 * Both colour paths ship: "Analyze my coloring" runs the live camera read
 * (`PersonalColorCapture` → `POST /analysis/personal-color`), whose founding
 * read is free until a dossier exists, and "I know my season" stays for anyone
 * who would rather pick from the library.
 *
 * A failed read drops back to this screen with the manual path intact — the
 * live read can never dead-end the step, so offering it at step 1 costs a
 * member nothing but a moment.
 */
export function ColorPath({
  existingDossier,
  onBack,
  onCandidateReady,
  onContinueExisting,
}: {
  existingDossier: StudioDossier | null;
  onBack: () => void;
  onCandidateReady: (candidate: StudioColorProfile) => void;
  onContinueExisting: () => void;
}) {
  const [showKnown, setShowKnown] = useState(false);
  const [tileId, setTileId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);

  if (!showKnown) {
    return (
      <StepShell step="color-path" onBack={onBack}>
        <View className="gap-lg">
          {existingDossier ? (
            <Card>
              <Text className="font-body-medium text-base text-ink">
                You already have a saved result: {existingDossier.subSeason}
              </Text>
              <Text className="font-body text-sm text-body mt-xs">
                Keep it, or choose a different season below.
              </Text>
              <Button
                label={`Continue with ${existingDossier.season}`}
                variant="secondary"
                onPress={onContinueExisting}
                className="mt-md"
              />
            </Card>
          ) : null}

          <OptionTile
            title="Analyze my coloring"
            description="Use your camera and Mila reads your true tones live, in good natural light."
            selected={false}
            onPress={() => setCaptureOpen(true)}
          />

          <OptionTile
            title="I know my season"
            description="Pick your seasonal palette from our full sixteen-season library. No camera needed."
            selected={false}
            onPress={() => setShowKnown(true)}
          />

          <Text className="font-body text-sm text-muted">
            Not sure which is yours? Pick the one closest to your colouring — you can change it any
            time in your style dossier.
          </Text>

          {captureOpen ? (
            <PersonalColorCapture
              onClose={() => setCaptureOpen(false)}
              onComplete={(profile) => {
                setCaptureOpen(false);
                onCandidateReady(profile);
              }}
            />
          ) : null}
        </View>
      </StepShell>
    );
  }

  return (
    <StepShell
      step="color-path"
      onBack={() => setShowKnown(false)}
      onContinue={() => {
        const tile = ALL_TILES.find((t) => t.id === tileId);
        if (tile) onCandidateReady(knownTileToCandidate(tile.key, tile.label, existingDossier));
      }}
      continueLabel="Preview this palette"
      continueDisabled={!tileId}
    >
      <View accessibilityRole="radiogroup" className="gap-xl">
        <Text className="font-body text-sm text-body">
          Tap the sub-season closest to your colouring.
        </Text>

        {KNOWN_SEASON_GROUPS.map((group) => (
          <View key={group.season} className="gap-md">
            <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
              {group.season}
            </Text>
            {group.tiles.map((tile) => (
              <OptionTile
                key={tile.id}
                title={tile.label}
                description={SEASONS_MASTER_DATA[tile.key].subSeason}
                selected={tileId === tile.id}
                onPress={() => setTileId(tile.id)}
              />
            ))}
          </View>
        ))}
      </View>
    </StepShell>
  );
}
