import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { dossierCompletion } from "@/lib/style-profile/completion";
import { useNudgeStore } from "@/stores/nudge-store";
import type { DashboardProfile } from "@/types/models";

/**
 * Nudges her toward the dossier signals onboarding let her skip. It never
 * blocks, and one dismissal keeps it gone.
 *
 * It sits at the foot of the screen rather than the head, where the web puts
 * it: the daily look is what she opened the app for at 7:40am, and a progress
 * meter above the generate button is a dashboard asking to be served.
 */
export function DossierCompletionCard({ profile }: { profile: DashboardProfile | undefined }) {
  const dismissed = useNudgeStore((s) => s.dossierDismissed);
  const hydrated = useNudgeStore((s) => s.hydrated);
  const dismiss = useNudgeStore((s) => s.dismissDossier);

  const { percent, missing } = dossierCompletion(profile);
  if (!hydrated || dismissed || !profile || missing.length === 0) return null;

  return (
    <Card className="gap-md">
      <View className="flex-row items-start gap-md">
        <View className="flex-1 gap-xs">
          <Text accessibilityRole="header" className="font-display text-lg text-ink">
            Your dossier is {percent}% complete
          </Text>
          <Text className="font-body text-sm text-body">
            Still to add: {missing.join(", ")}.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss this reminder"
          onPress={dismiss}
          style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
          className="h-tap w-tap items-center justify-center"
        >
          <Icon name="close" size="sm" color="muted" />
        </Pressable>
      </View>

      {/* The percentage is in the heading above, so the bar is decoration for
          the eye and the label carries the number for everyone else. */}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Dossier ${percent} percent complete`}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        className="h-xs overflow-hidden rounded-pill bg-accent-soft"
      >
        {/* Case 1 of the StyleSheet exceptions: the width is member data, and
            no Tailwind width utility covers an arbitrary percentage. */}
        <View style={{ width: `${percent}%` }} className="h-full rounded-pill bg-accent" />
      </View>

      <Button
        label="Complete your dossier"
        variant="secondary"
        onPress={() => router.push("/studio")}
      />
    </Card>
  );
}
