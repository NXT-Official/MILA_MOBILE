import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

import { StepShell } from "../components/StepShell";

/**
 * The fork after the seventh question.
 *
 * Everything Mila needs to style her is already saved by the time this screen
 * renders — the seven answers below are the whole required profile. The rest of
 * the wizard only runs if she taps the second button, which is the point: a
 * registration that asks fifteen questions up front reads as a form, and most
 * people stop answering partway through one.
 */
const ANSWERED = [
  "Your colouring",
  "Your gender",
  "Skin depth",
  "Body silhouette",
  "Face shape",
  "Hair type",
  "Hair length",
];

export function Refine({
  onBack,
  onFinish,
  onAddDetail,
}: {
  onBack: () => void;
  onFinish: () => void;
  onAddDetail: () => void;
}) {
  return (
    <StepShell
      step="refine"
      onBack={onBack}
      onContinue={onFinish}
      continueLabel="Save & continue"
    >
      <View className="gap-lg">
        <Card>
          <View className="flex-row items-start gap-md">
            <View className="mt-xs">
              <Icon name="sparkle" size="sm" color="accent" />
            </View>
            <View className="flex-1 gap-xs">
              <Text className="font-body-medium text-base text-ink">
                That&apos;s the seven answers Mila needs — your profile is ready.
              </Text>
              <Text className="font-body text-sm text-body">
                Mila can already style your daily looks from this. The questions after this point are
                optional: answer them only if you want more precise recommendations.
              </Text>
            </View>
          </View>
        </Card>

        <View className="gap-xs">
          {ANSWERED.map((item) => (
            <Text key={item} className="font-body text-base text-ink">
              · {item}
            </Text>
          ))}
        </View>

        <Card>
          <Text className="font-body-medium text-base text-ink">Want sharper looks?</Text>
          <Text className="font-body text-sm text-body mt-xs">
            Measurements, makeup preference, beauty priorities, location, and shopping preferences
            let Mila adapt fit, colour, and weather to you. You can also add them later from your
            profile.
          </Text>
          <Button
            label="Add more detail (optional)"
            variant="outline"
            className="mt-md"
            onPress={onAddDetail}
          />
        </Card>
      </View>
    </StepShell>
  );
}
