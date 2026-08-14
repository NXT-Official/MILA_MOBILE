import { Text, View } from "react-native";

import { cn } from "@/utils/cn";

/**
 * A member's initial in a champagne-washed disc.
 *
 * Mila stores no avatars, so this is the only representation a member has in the
 * feed. Playfair, because a single letter at this size is a monogram rather than
 * body copy — the one place a lone character earns the display face.
 */
export function AvatarInitial({ name, className }: { name: string; className?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(
        "h-2xl w-2xl items-center justify-center rounded-pill border border-border bg-accent-soft dark:border-border/12",
        className,
      )}
    >
      <Text className="font-display text-sm text-ink">{(name[0] ?? "M").toUpperCase()}</Text>
    </View>
  );
}
