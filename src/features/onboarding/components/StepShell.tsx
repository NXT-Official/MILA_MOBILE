import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { COUNTED_STEPS, getOnboardingStepIndex, type OnboardingStepId } from "@/constants/steps";
import { spacing } from "@/theme/tokens";

import { ProgressBar } from "./ProgressBar";
import { SaveStatus, type SaveState } from "./SaveStatus";

type StepShellProps = {
  step: OnboardingStepId;
  children: ReactNode;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  /** Renders "I'll do this later" — only the two optional steps pass this. */
  onSkip?: () => void;
  saveState?: SaveState;
  onRetrySave?: () => void;
};

/**
 * The one frame every step renders inside — title, progress, save status, back,
 * continue. Nine route files would duplicate all five of those nine times, and
 * they would drift.
 *
 * The footer is pinned below the scroll area rather than inside it: Continue is
 * the only control that matters at 7:40am and it should not require a scroll to
 * reach.
 */
export function StepShell({
  step,
  children,
  onBack,
  onContinue,
  continueLabel = "Continue",
  continueDisabled,
  continueLoading,
  onSkip,
  saveState = "idle",
  onRetrySave,
}: StepShellProps) {
  const insets = useSafeAreaInsets();
  const index = getOnboardingStepIndex(step);
  const meta = COUNTED_STEPS[index];

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing["2xl"] }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-xl py-xl">
          <ProgressBar current={step} />

          {meta ? (
            <View className="gap-sm">
              {/* accessibilityRole="header" moves the screen reader's focus
                  here on every step change, which is the mobile equivalent of
                  the web's focus() on the heading. */}
              <Text
                accessibilityRole="header"
                className="font-display text-h1 tracking-heading text-ink"
              >
                {meta.title}
              </Text>
              {meta.description ? (
                <Text className="font-body text-base text-body">{meta.description}</Text>
              ) : null}
            </View>
          ) : null}

          {children}
        </View>
      </ScrollView>

      <View
        className="gap-md border-t border-border dark:border-border/12 bg-canvas px-xl pt-lg"
        style={{ paddingBottom: insets.bottom + spacing.lg }}
      >
        {/* min-h-xl reserves the row so the footer does not jump when the save
            status appears mid-tap. */}
        <View className="min-h-xl flex-row items-center justify-between">
          <SaveStatus state={saveState} onRetry={onRetrySave} />
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip this step for now"
              onPress={onSkip}
              hitSlop={12}
            >
              <Text className="font-body text-micro text-muted underline">
                I&apos;ll do this later
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View className="flex-row gap-md">
          {onBack ? (
            <Button label="Back" variant="outline" onPress={onBack} className="flex-1" />
          ) : null}
          {onContinue ? (
            <Button
              label={continueLabel}
              onPress={onContinue}
              disabled={continueDisabled}
              loading={continueLoading}
              className="flex-[2]"
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
