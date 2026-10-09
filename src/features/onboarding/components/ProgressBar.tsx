import { Text, View } from "react-native";

import {
  CORE_QUESTION_COUNT,
  CORE_QUESTION_STEPS,
  COUNTED_STEPS,
  getCoreQuestionNumber,
  getOnboardingStepIndex,
  type OnboardingStepId,
} from "@/constants/steps";
import { cn } from "@/utils/cn";

/**
 * Two readings, on purpose.
 *
 * Through the required questions it counts questions — "Question 3 of 7" — so
 * the end is always in sight, and the two colour screens count as one question
 * because they are one answer.
 *
 * From the fork onwards the count is finished and the bar says so: the steps
 * left are optional extras she opted into, not a numbered queue. "Step 9 of 16"
 * there is what made registration feel bottomless.
 *
 * Returns null on `welcome` rather than rendering a zero state.
 */
export function ProgressBar({ current }: { current: OnboardingStepId }) {
  const index = getOnboardingStepIndex(current);
  const step = COUNTED_STEPS[index];
  if (index === -1 || !step) return null;

  const question = getCoreQuestionNumber(current);
  const filled = question ?? CORE_QUESTION_COUNT;
  const label = `${
    question !== null
      ? `Question ${question} of ${CORE_QUESTION_COUNT}`
      : step.optional
        ? "Optional extras"
        : "All seven questions answered"
  }: ${step.title}${step.optional ? ", optional" : ""}`;

  return (
    <View className="gap-md">
      <Text className="font-body-semibold text-section tracking-section uppercase text-accent">
        {question !== null
          ? `Question ${question} of ${CORE_QUESTION_COUNT}`
          : step.optional
            ? "Optional extras"
            : "All seven questions answered"}
        {step.optional ? (
          <Text className="font-body text-section tracking-normal text-muted"> · Optional</Text>
        ) : null}
      </Text>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: CORE_QUESTION_COUNT, now: filled, text: label }}
        className="flex-row gap-xs"
      >
        {CORE_QUESTION_STEPS.map((id, i) => (
          <View
            key={id}
            className={cn(
              "h-1 flex-1 rounded-pill",
              i < filled - 1 && "bg-accent",
              i === filled - 1 && "bg-ink",
              i > filled - 1 && "bg-border dark:bg-border/12",
            )}
          />
        ))}
      </View>
    </View>
  );
}
