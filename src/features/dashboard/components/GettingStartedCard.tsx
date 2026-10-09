import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  gettingStartedProgress,
  gettingStartedSteps,
  nextGettingStartedStep,
  readGettingStartedDismissed,
  writeGettingStartedDismissed,
  type DismissalStore,
  type GettingStartedInput,
} from "@/features/dashboard/getting-started";
import { persistStorage } from "@/stores/persist-storage";
import { cn } from "@/utils/cn";

/**
 * Home opens on statistics, which answer "how am I doing" and never "what do I
 * do". This card answers the second question in three lines and then leaves —
 * it hides itself the moment every step is done, and a member can dismiss it
 * sooner. It is not a tour, not a coach mark, and not a streak.
 */
export function GettingStartedCard(props: GettingStartedInput) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    // persistStorage() is a no-op store during the web export's static render,
    // so this read is safe on every platform.
    void readGettingStartedDismissed(persistStorage() as unknown as DismissalStore).then((value) => {
      if (alive) setDismissed(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    void writeGettingStartedDismissed(persistStorage() as unknown as DismissalStore);
  }, []);

  const steps = gettingStartedSteps(props);
  const progress = gettingStartedProgress(steps);

  if (dismissed || progress.allDone) return null;

  const next = nextGettingStartedStep(steps);

  return (
    <Card className="gap-lg p-lg">
      <View className="flex-row items-start justify-between gap-md">
        <View className="flex-1 gap-xs">
          <Text className="font-body-semibold text-micro tracking-label uppercase text-muted">
            Getting started
          </Text>
          <Text className="font-display text-h3 text-ink">Three things to do first</Text>
          <Text className="font-body text-sm text-body">
            {progress.done} of {progress.total} done
          </Text>
        </View>

        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss getting started"
          hitSlop={12}
          className="rounded-full p-sm active:opacity-70"
        >
          <Icon name="close" size="sm" color="muted" />
        </Pressable>
      </View>

      <View className="h-1 w-full overflow-hidden rounded-pill bg-surface-alt">
        {/* A percentage width cannot be a class — the one style object here. */}
        <View className="h-full bg-accent" style={{ width: `${progress.percent}%` }} />
      </View>

      <View className="gap-md">
        {steps.map((step) => (
          <View key={step.id} className="flex-row items-start gap-md">
            <View
              className={cn(
                "mt-xs h-5 w-5 items-center justify-center rounded-full border border-border dark:border-border/12",
                step.done && "border-transparent bg-accent-soft",
              )}
            >
              {step.done ? <Icon name="check" size="xs" color="accent" /> : null}
            </View>

            <View className="flex-1 gap-xs">
              <View className="flex-row items-center gap-sm">
                <Text
                  className={cn(
                    "font-body-semibold text-base",
                    step.done ? "text-muted" : "text-ink",
                  )}
                >
                  {step.title}
                </Text>
                {next?.id === step.id ? <Badge variant="accent" label="Start here" /> : null}
              </View>

              <Text className="font-body text-sm text-body">{step.hint}</Text>

              {!step.done && step.route ? (
                <Button
                  variant="secondary"
                  size="sm"
                  label={step.cta}
                  onPress={() => router.push(step.route as never)}
                  className="self-start"
                />
              ) : null}

              {!step.done && !step.route ? (
                <Text className="font-body text-sm text-muted">{step.cta}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}
