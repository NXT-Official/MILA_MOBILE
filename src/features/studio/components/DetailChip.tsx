import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";

/**
 * One dossier fact, at a glance — the web dossier's `DetailChip` (§3.8).
 *
 * An unset field with somewhere to go shows the way there instead of an em
 * dash, so the grid doubles as the completion prompt. A set field stays
 * tappable: on mobile these chips are the only editor for the attribute, and a
 * dead chip beside a live one is the worse surprise.
 */
export function DetailChip({
  label,
  value,
  onPress,
  diagram,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
  /** Shape-based values (silhouette, face, hair) show the shape, not just its name. */
  diagram?: ReactNode;
}) {
  const empty = !value;

  const body = (
    <>
      <View className="min-w-0 flex-1 gap-xs">
        <Text
          numberOfLines={1}
          className="font-body-semibold text-label tracking-label uppercase text-muted"
        >
          {label}
        </Text>
        {value ? (
          <Text numberOfLines={1} className="font-body text-sm text-ink">
            {value}
          </Text>
        ) : onPress ? (
          <View className="flex-row items-center gap-xs">
            <Icon name="add" size="xs" color="accent" />
            <Text className="font-body-semibold text-sm text-ink">Add</Text>
          </View>
        ) : (
          <Text className="font-body text-sm text-muted">—</Text>
        )}
      </View>
      {value ? diagram : null}
    </>
  );

  const className = [
    "min-h-tap flex-row items-center gap-sm rounded-control px-md py-sm",
    empty ? "border border-dashed border-border" : "border border-border bg-surface dark:border-border/12",
  ].join(" ");

  if (!onPress) {
    return <View className={className}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value?.trim() || "not set"}`}
      accessibilityHint="Opens this to change it"
      onPress={onPress}
      className={`active:opacity-80 ${className}`}
    >
      {body}
    </Pressable>
  );
}
