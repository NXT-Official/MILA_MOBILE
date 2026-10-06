import { router } from "expo-router";
import { Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Sheet } from "@/components/ui/Sheet";
import { useMySubscription } from "@/hooks/use-my-subscription";
import {
  formatBillingInterval,
  formatPlanPrice,
  useSubscriptionPlans,
} from "@/hooks/use-subscription-plans";
import { resolveMembership } from "@/lib/subscription-status";

/**
 * The response to `INSUFFICIENT_CREDITS` — a sheet, never a toast (§7).
 *
 * This is the primary conversion moment in the product, and a toast that fades
 * after three seconds is how it gets missed. It is opened by the server's error
 * code and by nothing else: no screen inspects a local balance to decide
 * whether to show it.
 *
 * Payments are not live yet, so the copy states what is true — a plan refills
 * its member's credits daily, a free member has no allowance to refill, and
 * memberships are coming — and the plans below are information, not an offer.
 * The button leads to the membership screen, which says the same.
 */
export function PaywallSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: plans, isPending, isError, refetch } = useSubscriptionPlans();
  const subscription = useMySubscription();

  // Only a plan in force refills credits each day. Everyone else — no plan, a
  // lapsed one, or a subscription that is still loading or unreadable — is told
  // plainly that she has used them, never that they come back tomorrow.
  const planInForce = resolveMembership(subscription.data).inForce;
  // "Memberships open soon" is only for someone who has none — and only once we
  // know that. A member who holds a plan (bought or granted by staff), or whose
  // subscription is still loading or unreadable, is told nothing about it.
  const showMembershipsSoon = !subscription.isPending && !subscription.isError && !planInForce;

  return (
    <Sheet visible={visible} onClose={onClose} title="You're out of credits">
      <View className="gap-lg">
        <Text className="font-body text-base text-body">
          {planInForce ? "Your credits reset tomorrow." : "You've used all your credits."}
          {showMembershipsSoon ? " Memberships open soon. Your stylist is getting ready." : ""}
        </Text>

        {isPending ? <LoadingState label="Loading membership plans" lines={3} /> : null}

        {isError ? (
          <ErrorState
            title="Plans didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        ) : null}

        {plans?.map((plan) => (
          <View
            key={plan.id}
            className="gap-xs rounded-panel border border-border bg-surface p-lg dark:border-border/12"
          >
            <View className="flex-row items-center justify-between gap-md">
              <Text className="font-body-semibold text-base text-ink">{plan.title}</Text>
              {plan.is_featured ? <Badge label="Most popular" variant="accent" /> : null}
            </View>
            <Text className="font-body text-sm text-body">
              {formatPlanPrice(plan.price_amount, plan.currency)}{" "}
              {formatBillingInterval(plan.billing_interval)} · {plan.credits_included} credits a day
            </Text>
          </View>
        ))}

        <Button
          label="View membership"
          onPress={() => {
            onClose();
            router.push("/membership");
          }}
        />
      </View>
    </Sheet>
  );
}
