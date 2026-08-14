import { Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";

/**
 * Names the price before the tap.
 *
 * This is disclosure, not accounting: it states what an action costs, never
 * what a member can afford. The server's `INSUFFICIENT_CREDITS` remains the
 * only authority on whether the action is allowed (§7), and nothing here reads
 * a balance.
 */
export function CreditCostHint({ credits }: { credits: number }) {
  const label = credits === 0 ? "Free" : `Uses ${credits} credit${credits === 1 ? "" : "s"}`;

  return (
    <View className="flex-row items-center gap-xs">
      <Icon name="sparkle" size="xs" color="muted" />
      <Text className="font-body text-micro text-muted">{label}</Text>
    </View>
  );
}
