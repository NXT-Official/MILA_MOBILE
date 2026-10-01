import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { formatResetCountdown } from "@/lib/credits-countdown";

import { Skeleton } from "./Skeleton";

/**
 * The credit balance, rendered and nothing more.
 *
 * This is a **display of server columns**, not a computation (§7). It does not
 * predict the daily reset, does not decrement on spend, and nothing in the app
 * branches on it — the server's `INSUFFICIENT_CREDITS` is the only authority on
 * whether an action is affordable, and it opens the paywall.
 *
 * The allowance is the live plan's `credits_included`, and it appears only
 * because the balance already includes what that plan owes today (see
 * `effectiveCredits`): "of 30" explains the figure rather than inventing one.
 * Without a plan there is no denominator, and none is shown.
 *
 * Deliberately not a progress bar: a member's daily allowance and her purchased
 * top-ups are different things, and drawing them as a fraction of some total
 * would invent a number the server never sent.
 */
export function CreditsMeter({
  balance,
  allowance,
  loading,
}: {
  balance: number | null;
  /** The live plan's daily allowance, or null when no plan owes one. */
  allowance: number | null;
  loading: boolean;
}) {
  const count = balance ?? 0;
  const resetIn = useResetCountdown();

  if (loading) {
    return (
      <View className="gap-sm rounded-panel border border-border bg-surface p-lg dark:border-border/12">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2xl w-1/4" />
      </View>
    );
  }

  const empty = count === 0;
  const label = `${count} ${count === 1 ? "credit" : "credits"} remaining${
    allowance ? ` of ${allowance} today` : ""
  }`;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}. ${empty ? "They reset tomorrow." : `Resets in ${resetIn}.`}`}
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
          {allowance
            ? `of ${allowance} left today`
            : count === 1
              ? "credit left"
              : "credits left"}
        </Text>
      </View>
      <Text className="font-body text-sm text-muted">
        {empty ? "They reset tomorrow." : `Resets in ${resetIn}.`}
      </Text>
    </View>
  );
}

/**
 * "13h 42m" to the next UTC midnight, refreshed once a minute.
 *
 * The same clock the credit RPCs bucket by (`utcDay`), so the countdown and the
 * reset cannot disagree. One interval for the minute hand, cleared on unmount —
 * the reset itself is still the server's to perform, and a foreground refetch
 * is what notices it.
 */
function useResetCountdown(): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return formatResetCountdown(now);
}
