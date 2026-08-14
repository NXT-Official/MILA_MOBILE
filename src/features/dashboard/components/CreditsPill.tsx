import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * `ai_credits + purchased_credits`, and nothing else.
 *
 * It does not predict the daily reset, does not decrement when a look is
 * generated, and nothing in the app branches on the number it shows. The
 * server's `INSUFFICIENT_CREDITS` is the only authority on affordability (§7),
 * so this is a readout, not a gate.
 *
 * An unreadable balance renders as a dash. A stale or guessed number on the
 * screen a member checks before spending would be worse than an honest gap.
 */
export function CreditsPill({
  balance,
  loading,
  onPress,
}: {
  balance: number | null;
  loading: boolean;
  onPress: () => void;
}) {
  if (loading) {
    return <Skeleton className="h-8 w-16 rounded-pill" />;
  }

  const known = balance !== null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        known ? `${balance} credits. View membership plans.` : "Credits unavailable. View membership plans."
      }
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
      className="min-h-tap justify-center"
    >
      <View className="flex-row items-center gap-xs rounded-pill bg-accent-soft px-md py-xs">
        <Icon name="sparkle" size="xs" color="ink" />
        <Text className="font-body-semibold text-micro text-ink">{known ? balance : "—"}</Text>
      </View>
    </Pressable>
  );
}
