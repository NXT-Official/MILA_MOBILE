import { Text, View } from "react-native";

import { cn } from "@/utils/cn";

import { Button } from "./Button";
import { Icon } from "./Icon";

type ErrorStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * Plain language and a retry affordance. **Never a raw error code** — the
 * member cannot act on `ANALYSIS_GATEWAY_FAILURE`.
 */
export function ErrorState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: ErrorStateProps) {
  return (
    <View className={cn("items-center gap-md px-xl", className)}>
      <Icon name="alert" size="lg" color="muted" />
      <Text className="font-display text-h3 text-ink text-center">{title}</Text>
      {description ? (
        <Text className="font-body text-base text-body text-center">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" onPress={onAction} className="mt-sm" />
      ) : null}
    </View>
  );
}

/** Inline form-level failure — the uniform auth message lives here. */
export function InlineError({ message }: { message: string }) {
  return (
    <View
      accessibilityLiveRegion="assertive"
      className="w-full flex-row items-start gap-sm rounded-control border border-destructive bg-surface px-lg py-md"
    >
      <View className="mt-xs">
        <Icon name="alert" size="sm" color="destructive" />
      </View>
      <Text className="flex-1 font-body text-sm text-ink">{message}</Text>
    </View>
  );
}
