import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { spacing } from "@/theme/tokens";

const REASONS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "studio",
    title: "Your colouring",
    body: "Undertone and seasonal palette shape every colour recommendation Mila makes.",
  },
  {
    icon: "silhouette",
    title: "Your silhouette & features",
    body: "Body shape, face shape, and hair type guide fit, cut, and styling choices.",
  },
  {
    icon: "sparkle",
    title: "Your preferences",
    body: "Beauty preferences and location fine-tune looks to how — and where — you actually live.",
  },
];

/**
 * Not counted in progress, so it renders outside StepShell — a progress bar
 * reading "Step 0 of 8" is worse than no progress bar.
 */
export function Welcome({ onBegin }: { onBegin: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing["2xl"] }}
      >
        <View className="gap-xl py-2xl">
          <View className="gap-sm">
            <Text className="font-body-semibold text-section tracking-section uppercase text-accent">
              Digital Style Dossier
            </Text>
            <Text
              accessibilityRole="header"
              className="font-display-bold text-display tracking-display text-ink"
            >
              Let&apos;s build your style profile.
            </Text>
          </View>

          <View className="gap-md">
            <Text className="font-body text-lg text-body">
              Mila uses your colouring, silhouette, features, and preferences to create
              recommendations that are specific to you — not generic inspiration.
            </Text>
            <Text className="font-body text-base text-muted">
              Seven quick questions — under two minutes. After that everything else is optional:
              answer the extras only if you want even more precise looks. Your progress saves as you
              go, and you can update your profile any time.
            </Text>
          </View>

          <View className="gap-md">
            {REASONS.map(({ icon, title, body }) => (
              <Card key={title}>
                <Icon name={icon} size="sm" color="accent" />
                <Text className="font-body-medium text-base text-ink mt-sm">{title}</Text>
                <Text className="font-body text-sm text-body mt-xs">{body}</Text>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="px-xl pt-lg" style={{ paddingBottom: insets.bottom + spacing.lg }}>
        <Button label="Begin my profile" size="lg" onPress={onBegin} />
      </View>
    </View>
  );
}
