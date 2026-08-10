import { Text, View } from "react-native";

import { COUNTED_STEPS, getOnboardingStepIndex, type OnboardingStepId } from "@/constants/steps";
import { cn } from "@/utils/cn";

/**
 * Reads COUNTED_STEPS, which excludes `welcome` — so the first counted step is
 * "Step 1 of 8", not "Step 2 of 9". Returns null on `welcome` rather than
 * rendering a zero state.
 */
export function ProgressBar({ current }: { current: OnboardingStepId }) {
  const index = getOnboardingStepIndex(current);
  const step = COUNTED_STEPS[index];
  const total = COUNTED_STEPS.length;
  if (index === -1 || !step) return null;

  const label = `Step ${index + 1} of ${total}: ${step.title}${step.optional ? ", optional" : ""}`;

  return (
    <View className="gap-md">
      <Text className="font-body-semibold text-section tracking-section uppercase text-accent">
        Step {index + 1} of {total}
        {step.optional ? (
          <Text className="font-body text-section tracking-normal text-muted"> · Optional</Text>
        ) : null}
      </Text>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: total, now: index + 1, text: label }}
        className="flex-row gap-xs"
      >
        {COUNTED_STEPS.map((s, i) => (
          <View
            key={s.id}
            className={cn(
              "h-1 flex-1 rounded-pill",
              i < index && "bg-accent",
              i === index && "bg-ink",
              i > index && "bg-border dark:bg-border/12",
            )}
          />
        ))}
      </View>
    </View>
  );
}
