import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { cn } from "@/utils/cn";

import { Divider } from "./Divider";
import { Icon, type IconName } from "./Icon";

/**
 * A settings panel: rows in one bordered container, hairline-separated.
 *
 * A **list, not a grid** (§10). A grid of tiles turns "change my password" into
 * a scavenger hunt, and it is the single most dashboard-like pattern a settings
 * screen can adopt.
 */
export function SettingsList({ children }: { children: ReactNode }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];

  return (
    <View className="overflow-hidden rounded-panel border border-border bg-surface dark:border-border/12">
      {rows.map((row, index) => (
        // Separators between rows only — a rule under the last row would draw a
        // second line against the container's own border.
        <View key={index}>
          {index > 0 ? <Divider /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}

/**
 * One row. `value` is the current state read aloud with the label, so TalkBack
 * announces "Default location, Manila" rather than leaving the value orphaned
 * in a second focus stop.
 */
export function SettingsRow({
  icon,
  label,
  value,
  destructive = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  /** The current setting, shown and announced alongside the label. */
  value?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      className="active:opacity-80 min-h-tap flex-row items-center gap-md px-lg py-md"
    >
      <Icon name={icon} size="sm" color={destructive ? "destructive" : "muted"} />

      <View className="flex-1 gap-xs">
        <Text
          className={cn(
            "font-body text-base",
            destructive ? "text-destructive" : "text-ink",
          )}
        >
          {label}
        </Text>
        {value ? <Text className="font-body text-micro text-muted">{value}</Text> : null}
      </View>

      <Icon name="chevronRight" size="sm" color="muted" />
    </Pressable>
  );
}
