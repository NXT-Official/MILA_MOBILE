import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { InlineError } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { cn } from "@/utils/cn";

import type { SaveState } from "../components/SaveStatus";
import { StepShell } from "../components/StepShell";

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

type Unit = "metric" | "imperial";

/**
 * Optional height/weight capture — ported from the web's `measurements-step`.
 * Stored normalised in metric (`height_cm`, `weight_kg`) regardless of which
 * unit she entered in. These feed the outfit prompt as light styling language
 * (petite/tall framing); there is no garment-size dataset to match against.
 */
export function Measurements({
  heightCm,
  weightKg,
  onBack,
  onSaved,
  onSkip,
  save,
  saveState,
  onRetrySave,
  saving,
}: {
  heightCm: number | null;
  weightKg: number | null;
  onBack: () => void;
  onSaved: () => void;
  onSkip: () => void;
  save: (payload: { height_cm: number | null; weight_kg: number | null }) => Promise<boolean>;
  saveState: SaveState;
  onRetrySave: () => void;
  saving: boolean;
}) {
  const [unit, setUnit] = useState<Unit>("metric");
  const [height, setHeight] = useState(heightCm == null ? "" : String(heightCm));
  const [weight, setWeight] = useState(weightKg == null ? "" : String(weightKg));
  const [error, setError] = useState<string | null>(null);

  function switchUnit(next: Unit) {
    if (next === unit) return;
    const h = Number(height);
    const w = Number(weight);
    if (height && Number.isFinite(h)) {
      setHeight(
        next === "imperial" ? String(Math.round(h / CM_PER_IN)) : String(Math.round(h * CM_PER_IN)),
      );
    }
    if (weight && Number.isFinite(w)) {
      setWeight(
        next === "imperial" ? String(Math.round(w / KG_PER_LB)) : String(Math.round(w * KG_PER_LB)),
      );
    }
    setUnit(next);
  }

  async function handleContinue() {
    setError(null);
    const h = height.trim() ? Number(height) : null;
    const w = weight.trim() ? Number(weight) : null;
    if ((h != null && !Number.isFinite(h)) || (w != null && !Number.isFinite(w))) {
      setError("Enter numbers only, or leave blank to skip.");
      return;
    }
    const height_cm = h == null ? null : Math.round(unit === "imperial" ? h * CM_PER_IN : h);
    const weight_kg = w == null ? null : Math.round(unit === "imperial" ? w * KG_PER_LB : w);
    if (height_cm != null && (height_cm < 100 || height_cm > 250)) {
      setError("Height looks out of range — double-check the unit or the value.");
      return;
    }
    if (weight_kg != null && (weight_kg < 30 || weight_kg > 250)) {
      setError("Weight looks out of range — double-check the unit or the value.");
      return;
    }
    if (await save({ height_cm, weight_kg })) onSaved();
  }

  const filled = height.trim().length > 0 || weight.trim().length > 0;

  return (
    <StepShell
      step="measurements"
      onBack={onBack}
      onContinue={handleContinue}
      continueLabel={filled ? "Continue" : "Skip"}
      continueLoading={saving}
      onSkip={onSkip}
      saveState={saveState}
      onRetrySave={onRetrySave}
    >
      <View className="gap-lg">
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Units"
          className="w-full flex-row gap-xs self-start rounded-pill bg-surface-alt p-xs"
        >
          {(["metric", "imperial"] as const).map((u) => (
            <Pressable
              key={u}
              accessibilityRole="radio"
              accessibilityState={{ selected: unit === u }}
              onPress={() => switchUnit(u)}
              className={cn(
                "rounded-control px-lg py-sm",
                unit === u ? "bg-surface border border-border dark:border-border/12" : "",
              )}
            >
              <Text
                className={cn(
                  "font-body-medium text-sm",
                  unit === u ? "text-ink" : "text-muted",
                )}
              >
                {u === "metric" ? "cm / kg" : "in / lb"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row gap-md">
          <View className="flex-1">
            <Input
              label={`Height (${unit === "metric" ? "cm" : "in"})`}
              size="lg"
              keyboardType="numeric"
              value={height}
              onChangeText={setHeight}
              placeholder={unit === "metric" ? "165" : "65"}
            />
          </View>
          <View className="flex-1">
            <Input
              label={`Weight (${unit === "metric" ? "kg" : "lb"})`}
              size="lg"
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
              placeholder={unit === "metric" ? "60" : "132"}
            />
          </View>
        </View>

        {error ? <InlineError message={error} /> : null}
      </View>
    </StepShell>
  );
}
