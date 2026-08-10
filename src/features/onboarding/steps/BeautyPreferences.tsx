import { useState } from "react";
import { Text, View } from "react-native";

import { Chip } from "@/components/ui/Chip";
import { BEAUTY_PREFERENCE_TAGS } from "@/constants/style-profile";
import type { Json } from "@/types/models";

import type { SaveState } from "../components/SaveStatus";
import { StepShell } from "../components/StepShell";

/** Optional. Selecting nothing is a valid answer, not an empty state. */
export function BeautyPreferences({
  value,
  onBack,
  onSaved,
  onSkip,
  save,
  saveState,
  onRetrySave,
  saving,
}: {
  value: string[];
  onBack: () => void;
  onSaved: () => void;
  onSkip: () => void;
  save: (preferences: Json) => Promise<boolean>;
  saveState: SaveState;
  onRetrySave: () => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(value);

  function toggle(tag: string) {
    setSelected((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleContinue() {
    if (await save(selected as unknown as Json)) onSaved();
  }

  return (
    <StepShell
      step="beauty-preferences"
      onBack={onBack}
      onContinue={handleContinue}
      continueLabel={selected.length === 0 ? "Continue without preferences" : "Continue"}
      continueLoading={saving}
      onSkip={onSkip}
      saveState={saveState}
      onRetrySave={onRetrySave}
    >
      <View className="gap-lg">
        <Text className="font-body text-base text-body">
          Select the finishes you want Mila to prioritise in makeup and beauty suggestions. This
          step is optional — leave everything unselected for no preference.
        </Text>

        <View className="flex-row flex-wrap gap-sm">
          {BEAUTY_PREFERENCE_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={selected.includes(tag)}
              onPress={() => toggle(tag)}
            />
          ))}
        </View>

        {selected.length === 0 ? (
          <Text className="font-body text-sm text-muted">
            Nothing selected — Mila will style you without a bias, and you can add preferences any
            time from your profile.
          </Text>
        ) : null}
      </View>
    </StepShell>
  );
}
