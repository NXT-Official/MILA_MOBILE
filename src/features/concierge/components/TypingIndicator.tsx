import { Text, View } from "react-native";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mila is composing.
 *
 * Two uneven bars in the shape a reply will take, not a spinner and not three
 * bouncing dots (§10) — the skeleton says what is arriving, and the reduced-
 * motion path is already handled inside `Skeleton`.
 */
export function TypingIndicator() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Mila is composing a reply"
      accessibilityState={{ busy: true }}
      className="w-full items-start gap-xs"
    >
      <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
        Mila
      </Text>
      <View className="w-[85%] gap-sm rounded-card border border-border bg-surface px-lg py-md dark:border-border/12">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </View>
    </View>
  );
}
