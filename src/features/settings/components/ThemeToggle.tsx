import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { THEME_OPTIONS, useTheme } from "@/hooks/use-theme";
import { cn } from "@/utils/cn";

/**
 * Light, Dark, or follow the device.
 *
 * Selection is carried by the check mark **and** the border weight **and** the
 * wash — never by hue alone (§10). Persisted to AsyncStorage by the store, so
 * the choice survives a cold start without this component knowing about it.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <View className="gap-sm">
      {THEME_OPTIONS.map((option) => {
        const selected = option.value === preference;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label}. ${option.hint}`}
            onPress={() => setPreference(option.value)}
            className={cn(
              "active:opacity-85 min-h-tap flex-row items-center gap-md rounded-panel border px-lg py-md",
              selected
                ? "border-ink bg-accent-soft"
                : "border-border bg-surface dark:border-border/12",
            )}
          >
            <View className="w-lg">
              {selected ? <Icon name="check" size="sm" color="ink" /> : null}
            </View>
            <View className="flex-1 gap-xs">
              <Text className="font-body-medium text-base text-ink">{option.label}</Text>
              <Text className="font-body text-micro text-muted">{option.hint}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
