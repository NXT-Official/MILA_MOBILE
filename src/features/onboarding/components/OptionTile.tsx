import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

type OptionTileProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * The primary interaction of onboarding — a member taps roughly forty of these
 * in five minutes, one-handed. Hence `min-h-tile` (56px): above the 44px floor,
 * because a mis-tap here writes the wrong silhouette to her profile and
 * mis-styles every recommendation that follows.
 *
 * Selection reads three ways at once — check mark, ink border, champagne wash
 * — so no state is encoded in hue alone.
 */
export function OptionTile({ title, description, selected, onPress }: OptionTileProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.9, transform: [{ scale: 0.99 }] } : undefined)}
      className={cn(
        "min-h-tile flex-row items-start gap-md rounded-panel border p-lg",
        selected
          ? "border-ink bg-accent-soft"
          : "border-border bg-surface dark:border-border/12",
      )}
    >
      <View className="flex-1 gap-xs">
        <Text className="font-body-medium text-base text-ink">{title}</Text>
        {description ? (
          <Text className="font-body text-sm text-body">{description}</Text>
        ) : null}
      </View>
      {selected ? (
        <View className="mt-xs">
          <Icon name="check" size="sm" color="ink" />
        </View>
      ) : null}
    </Pressable>
  );
}
