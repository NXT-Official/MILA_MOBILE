import { Pressable, Text, View } from "react-native";

import { cn } from "@/utils/cn";

import { Icon } from "./Icon";

type SelectRowProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * One option in a single-select list — the row used by every picker sheet and
 * by onboarding.
 *
 * `min-h-tile` (56px), above the 44px floor, because these lists are tapped
 * one-handed and at speed: a mis-tap writes the wrong silhouette to a profile
 * or the wrong occasion into a styling prompt.
 *
 * Selection reads three ways at once — check mark, ink border, champagne wash —
 * so no state is encoded in hue alone.
 */
export function SelectRow({ title, description, selected, onPress }: SelectRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.9, transform: [{ scale: 0.99 }] } : undefined)}
      className={cn(
        "min-h-tile flex-row items-start gap-md rounded-panel border p-lg",
        selected ? "border-ink bg-accent-soft" : "border-border bg-surface dark:border-border/12",
      )}
    >
      <View className="flex-1 gap-xs">
        <Text className="font-body-medium text-base text-ink">{title}</Text>
        {description ? <Text className="font-body text-sm text-body">{description}</Text> : null}
      </View>
      {selected ? (
        <View className="mt-xs">
          <Icon name="check" size="sm" color="ink" />
        </View>
      ) : null}
    </Pressable>
  );
}
