import { Text, View } from "react-native";

import { Skeleton } from "./Skeleton";

/**
 * The credit balance, rendered and nothing more.
 *
 * This is a **display of two server columns**, not a computation (§7). It does
 * not predict the daily reset, does not decrement on spend, and nothing in the
 * app branches on it — the server's `INSUFFICIENT_CREDITS` is the only
 * authority on whether an action is affordable, and it opens the paywall.
 *
 * Deliberately not a progress bar: there is no denominator. A member's daily
 * allowance and her purchased top-ups are different things, and drawing them as
 * a fraction of some total would invent a number the server never sent.
 */
export function CreditsMeter({
  balance,
  loading,
}: {
  balance: number | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <View className="gap-sm rounded-panel border border-border bg-surface p-lg dark:border-border/12">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2xl w-1/4" />
      </View>
    );
  }

  const count = balance ?? 0;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${count} ${count === 1 ? "credit" : "credits"} remaining`}
      className="gap-sm rounded-panel border border-border bg-surface p-lg dark:border-border/12"
    >
      <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
        Credits
      </Text>
      <View className="flex-row items-baseline gap-sm">
        {/* Playfair for the figure: a pulled numeral, the editorial equivalent
            of a headline — not a metric on a dashboard. */}
        <Text className="font-display text-h1 tracking-heading text-ink">{count}</Text>
        <Text className="font-body text-sm text-body">
          {count === 1 ? "credit left" : "credits left"}
        </Text>
      </View>
    </View>
  );
}
