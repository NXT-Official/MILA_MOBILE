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
      // "Continue without preferences" wrapped to two lines and was clipped by
      // the button's fixed height on a 360dp screen. The helper text below
      // already says what continuing empty means.
      continueLabel="Continue"
      continueLoading={saving}
      onSkip={onSkip}
      saveState={saveState}
      onRetrySave={onRetrySave}
    >
      <View className="gap-lg">
        {/* StepShell already renders the step's own description from
            `ONBOARDING_STEPS`; repeating it here stacked two near-identical
            paragraphs. Only the part it does not say belongs in this file. */}
        <Text className="font-body text-base text-body">
          Optional — leave everything unselected for no preference.
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
