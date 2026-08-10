import { useState } from "react";
import { Text, View } from "react-native";

import type { OnboardingStepId } from "@/constants/steps";
import type { MatrixOption } from "@/constants/style-profile";

import { OptionTile } from "../components/OptionTile";
import type { SaveState } from "../components/SaveStatus";
import { StepShell } from "../components/StepShell";

/**
 * Body type, face shape, and hair type are the same interaction three times —
 * one required choice from a fixed list. Three components would be three places
 * to fix the same bug. The web makes the same call (`single-select-step.tsx`).
 */
export function SingleSelect({
  step,
  value,
  options,
  guidance,
  requiredMessage,
  onBack,
  onSaved,
  save,
  saveState,
  onRetrySave,
  saving,
}: {
  step: OnboardingStepId;
  value: string | null;
  options: MatrixOption[];
  guidance: string;
  requiredMessage: string;
  onBack: () => void;
  onSaved: () => void;
  save: (value: string) => Promise<boolean>;
  saveState: SaveState;
  onRetrySave: () => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(value);
  const [showRequired, setShowRequired] = useState(false);

  async function handleContinue() {
    if (!selected) {
      setShowRequired(true);
      return;
    }
    if (await save(selected)) onSaved();
  }

  return (
    <StepShell
      step={step}
      onBack={onBack}
      onContinue={handleContinue}
      continueLoading={saving}
      saveState={saveState}
      onRetrySave={onRetrySave}
    >
      <View className="gap-lg">
        <Text className="font-body text-base text-body">{guidance}</Text>

        <View accessibilityRole="radiogroup" className="gap-md">
          {options.map((option) => (
            <OptionTile
              key={option.value}
              title={option.title}
              description={option.description}
              selected={selected === option.value}
              onPress={() => {
                setSelected(option.value);
                setShowRequired(false);
              }}
            />
          ))}
        </View>

        {showRequired && !selected ? (
          <Text
            accessibilityLiveRegion="assertive"
            className="font-body text-sm text-destructive"
          >
            {requiredMessage}
          </Text>
        ) : null}
      </View>
    </StepShell>
  );
}
