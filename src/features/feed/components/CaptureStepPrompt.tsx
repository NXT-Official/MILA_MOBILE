import { Text, View } from "react-native";

import type { CaptureStep } from "@/stores/capture-store";

/**
 * The instruction over the live preview.
 *
 * Both prompts are the web's verbatim: "Mirror selfie, full body" and "Front
 * camera portrait". They are terse on purpose — she is holding the phone at
 * arm's length reading them at a glance, not settling in for guidance.
 */
const PROMPTS: Record<Exclude<CaptureStep, "review">, { title: string; hint: string }> = {
  back: {
    title: "Mirror selfie, full body",
    hint: "The whole outfit, head to shoe. This is the photo Mila reads for pieces.",
  },
  front: {
    title: "Front camera portrait",
    hint: "Just you. It sits as a small portrait over your outfit.",
  },
};

export function CaptureStepPrompt({ step }: { step: Exclude<CaptureStep, "review"> }) {
  const prompt = PROMPTS[step];

  return (
    <View className="gap-xs px-xl py-md">
      <Text accessibilityRole="header" className="font-display text-h3 text-ink">
        {prompt.title}
      </Text>
      <Text className="font-body text-sm text-body">{prompt.hint}</Text>
      <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
        Step {step === "back" ? "1" : "2"} of 2
      </Text>
    </View>
  );
}
