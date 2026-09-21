import { useState } from "react";
import { Text, View } from "react-native";

import { Chip } from "@/components/ui/Chip";
import type { OnboardingStepId } from "@/constants/steps";
import type { Json } from "@/types/models";

import type { SaveState } from "../components/SaveStatus";
import { StepShell } from "../components/StepShell";

/**
 * Generic optional multi-select tag step for freeform JSONB preference columns
 * — the web's `tag-select-step.tsx`. Shopping preferences and styling
 * constraints are the same interaction twice, and `BeautyPreferences` is the
 * same shape with a bespoke body; this one takes the web's guidance and empty
 * hint as props so the three stay one component wide.
 */
export function TagSelect({
  step,
  tags,
  value,
  guidance,
  emptyHint,
  onBack,
  onSaved,
  onSkip,
  save,
  saveState,
  onRetrySave,
  saving,
}: {
  step: OnboardingStepId;
  tags: readonly string[];
  value: string[];
  guidance: string;
  emptyHint: string;
  onBack: () => void;
  onSaved: () => void;
  onSkip: () => void;
  save: (tags: Json) => Promise<boolean>;
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
      step={step}
      onBack={onBack}
      onContinue={handleContinue}
      // The web's "Continue without preferences" wraps to two lines and is
      // clipped by the button's fixed height on a 360dp screen; the empty hint
      // below already says what continuing empty means.
      continueLabel="Continue"
      continueLoading={saving}
      onSkip={onSkip}
      saveState={saveState}
      onRetrySave={onRetrySave}
    >
      <View className="gap-lg">
        <Text className="font-body text-base text-body">{guidance}</Text>

        <View className="flex-row flex-wrap gap-sm">
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={selected.includes(tag)}
              onPress={() => toggle(tag)}
            />
          ))}
        </View>

        {selected.length === 0 ? (
          <Text className="font-body text-sm text-muted">{emptyHint}</Text>
        ) : null}
      </View>
    </StepShell>
  );
}
