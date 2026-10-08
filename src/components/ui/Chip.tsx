import { Pressable, Text } from "react-native";

import { cn } from "@/utils/cn";

import { Icon } from "./Icon";

type ChipProps = {
  label: string;
  selected: boolean;
  /** One choice among many (a view, a filter) rather than one of several
   * picks: screen readers hear a radio, so the group reads as exclusive. */
  single?: boolean;
  onPress: () => void;
};

/**
 * A multi-select pill. Selection is carried by the check mark, the border
 * weight, AND the wash — never by colour alone, so it survives both a
 * colour-blind member and a greyscale screenshot.
 *
 * 44px minimum target: chips sit in a wrapping grid where a mis-tap picks the
 * neighbouring preference.
 */
export function Chip({ label, selected, single = false, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole={single ? "radio" : "checkbox"}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={cn(
        "active:opacity-90 min-h-tap flex-row items-center gap-sm rounded-pill border px-lg py-md",
        selected
          ? "border-ink bg-accent-soft"
          : "border-border bg-surface dark:border-border/12",
      )}
    >
      {selected ? <Icon name="check" size="xs" color="ink" /> : null}
      <Text
        className={cn(
          "font-body-medium text-sm",
          selected ? "text-ink" : "text-body",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
