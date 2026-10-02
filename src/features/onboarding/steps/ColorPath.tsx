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
 * "I know my season" is the only path this phase ships.
 *
 * The live read costs a credit and `DEFAULT_AI_CREDITS` is 0, so offering it to
 * a member who has had no reason to pay yet is a dead end — the web has the
 * same tile commented out. It returns with the Lens camera in Phase 05, where
 * the paywall already exists (Appendix D.2).
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
            title="I know my season"
            description="Pick your seasonal palette from our full sixteen-season library. No camera needed."
            selected={false}
            onPress={() => setShowKnown(true)}
          />

          <Text className="font-body text-sm text-muted">
            Not sure which is yours? Pick the one closest to your colouring — you can change it any
            time in your style dossier.
          </Text>
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
