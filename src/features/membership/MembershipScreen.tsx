import { router } from "expo-router";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { CreditsMeter } from "@/components/ui/CreditsMeter";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useCreditBalance, useCredits } from "@/hooks/use-credits";
import { useMySubscription } from "@/hooks/use-my-subscription";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import { resolveMembership } from "@/lib/subscription-status";

import { MembershipStatusRow } from "./components/MembershipStatusRow";
import { PlanCard } from "./components/PlanCard";

/**
 * Membership: where she stands, what she has, and what each plan gives.
 *
 * **Entitlement is read, never computed.** Everything on this screen comes from
 * `subscriptions` and `user_entitlements`, both written server-side by the
 * Paddle webhook — the system of record (§9). Nothing here decides access, and
 * there is no optimistic state anywhere, so there is nothing to roll back.
 *
 * **No checkout.** Purchase, cancel, and resume are gated on Appendix D.1
 * (Paddle hosted checkout vs. native IAP), which is still an open product
 * decision. Until it is recorded there is deliberately no purchase affordance
 * at all — not even a disabled one, which would advertise something the app
 * cannot do and would have to be unpicked if the answer is IAP.
 */
export function MembershipScreen() {
  const plans = useSubscriptionPlans();
  const subscription = useMySubscription();
  const credits = useCredits();
  const balance = useCreditBalance();

  const membership = resolveMembership(subscription.data);
  const currentPlan = subscription.data
    ? (plans.data?.find((plan) => plan.id === subscription.data?.plan_id) ?? null)
    : null;

  return (
    <Screen scroll>
      <View className="gap-xl py-xl">
        <View className="gap-sm">
          <Text
            accessibilityRole="header"
            className="font-display text-h1 tracking-heading text-ink"
          >
            Membership
          </Text>
          <Text className="font-body text-base text-body">
            Credits refresh every day with a membership. They are what Mila spends composing your
            looks.
          </Text>
        </View>

        <MembershipStatusRow
          state={membership}
          planTitle={currentPlan?.title ?? null}
          loading={subscription.isPending}
        />

        <CreditsMeter balance={balance} loading={credits.isPending} />

        {plans.isPending ? <LoadingState label="Loading membership plans" lines={4} /> : null}

        {plans.isError ? (
          <ErrorState
            title="Plans didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void plans.refetch()}
          />
        ) : null}

        {plans.data?.length === 0 ? (
          <EmptyState
            icon="sparkle"
            title="No plans right now"
            description="Memberships are being updated. Try again shortly."
            actionLabel="Refresh"
            onAction={() => void plans.refetch()}
          />
        ) : null}

        {plans.data?.map((plan) => (
          <PlanCard key={plan.id} plan={plan} current={plan.id === currentPlan?.id} />
        ))}

        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
