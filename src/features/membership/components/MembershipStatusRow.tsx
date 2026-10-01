import { Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { STAFF_GRANTED_SUBSCRIPTION_NOTICE } from "@/constants/subscriptions";
import { formatPeriodDate, type MembershipState } from "@/lib/subscription-status";

/**
 * Where the member stands, in her own words.
 *
 * Every state carries a sentence, not just a badge — the Colour-Is-Content rule
 * (§10) applies to status as much as to swatches, and "past_due" in a coloured
 * pill tells someone nothing about what to do.
 */
export function MembershipStatusRow({
  state,
  planTitle,
  loading,
}: {
  state: MembershipState;
  /** The plan the subscription points at, or null while it resolves. */
  planTitle: string | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <View className="gap-sm rounded-panel border border-border bg-surface p-lg dark:border-border/12">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-2/3" />
      </View>
    );
  }

  if (state.headline === "none") {
    return (
      <View className="gap-sm rounded-panel border border-border bg-surface p-lg dark:border-border/12">
        <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
          Membership
        </Text>
        <Text className="font-body text-base text-ink">You are on the free tier.</Text>
      </View>
    );
  }

  const date = formatPeriodDate(state.date);

  // A plan staff granted by hand: no renewal, no end date, and the reason the
  // cancel button is not here. The web's copy, verbatim.
  if (state.headline === "granted") {
    return (
      <View className="gap-md rounded-panel border border-border bg-surface p-lg dark:border-border/12">
        <View className="flex-row items-center justify-between gap-md">
          <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
            Membership
          </Text>
          <Badge label="Granted" variant="success" />
        </View>

        {planTitle ? <Text className="font-display text-h3 text-ink">{planTitle}</Text> : null}

        <Text className="font-body text-base text-body">By the Mila team.</Text>
        <Text className="font-body text-sm text-muted">{STAFF_GRANTED_SUBSCRIPTION_NOTICE}</Text>
      </View>
    );
  }

  return (
    <View className="gap-md rounded-panel border border-border bg-surface p-lg dark:border-border/12">
      <View className="flex-row items-center justify-between gap-md">
        <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
          Membership
        </Text>
        {state.inForce ? <Badge label="Active" variant="success" /> : null}
      </View>

      {planTitle ? <Text className="font-display text-h3 text-ink">{planTitle}</Text> : null}

      <Text className="font-body text-base text-body">
        {state.headline === "renews"
          ? date
            ? `Renews on ${date}.`
            : "Renews automatically."
          : state.headline === "ends"
            ? // Cancelling is not losing access today, and the copy has to say
              // so or a member will assume she has already lost it.
              date
              ? `Cancelled. Your access continues until ${date}.`
              : "Cancelled. Your access continues until the end of the period."
            : date
              ? `Your membership ended on ${date}.`
              : "Your membership has ended."}
      </Text>

      {state.paymentFailing ? (
        <View className="flex-row items-start gap-sm">
          <View className="mt-xs">
            <Icon name="alert" size="xs" color="warning" />
          </View>
          {/* In force, deliberately: a retry is still running and locking her
              out mid-dunning would take away something she paid for. */}
          <Text className="flex-1 font-body text-sm text-body">
            The last payment did not go through. Your access continues while it is retried — update
            your card to keep it.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
