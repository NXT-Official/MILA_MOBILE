import { Text, View } from "react-native";

import { cn } from "@/utils/cn";

import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

type EmptyStateProps = {
  icon: IconName;
  title: string;
  /** One line. An empty state that explains itself twice is a wall of text. */
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * The §10 shape: an icon, a title, one line of copy, and one action. An empty
 * screen is an invitation, so the copy names what will fill it rather than
 * reporting that nothing is there.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <View className={cn("items-center gap-md px-xl", className)}>
      <Icon name={icon} size="lg" color="muted" />
      <Text className="font-display text-h3 text-ink text-center">{title}</Text>
      <Text className="font-body text-base text-body text-center">{description}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" onPress={onAction} className="mt-sm" />
      ) : null}
    </View>
  );
}
