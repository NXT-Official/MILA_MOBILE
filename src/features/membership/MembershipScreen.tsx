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
import { MembershipActions } from "./components/MembershipActions";
import { PlanCard } from "./components/PlanCard";

/**
 * Membership: where she stands, what she has, and what each plan gives.
 *
 * **Entitlement is read, never computed.** Everything on this screen comes from
 * `subscriptions` and `user_entitlements`, both written server-side by the
 * Paddle webhook — the system of record (§9). Nothing here decides access, and
 * there is no optimistic state anywhere, so there is nothing to roll back.
 *
 * Existing memberships can cancel or resume through the same server handlers
 * as web. Store purchases require configured products and verified receipts
 * before this screen can offer a purchase (§9).
 */
export function MembershipScreen() {
  const plans = useSubscriptionPlans();
  const subscription = useMySubscription();
  const credits = useCredits();
  const balance = useCreditBalance();

  const membership = resolveMembership(subscription.data);
  const currentPlan = subscription.data
    ? (plans.data?.find((plan) => plan.id === subscription.data?.plan_id) ??
      null)
    : null;

  // Purchases are not open yet, and the plan cards carry no purchase control, so
  // nothing here may invite a choice. A member who already holds a plan is not
  // told memberships are closed, and neither is anyone while it is still loading.
  const intro =
    subscription.isPending || subscription.isError
      ? "What each plan includes."
      : membership.inForce
        ? "Your membership and what each plan includes."
        : "Memberships open soon. Your stylist is getting ready.";

  return (
    <Screen scroll>
      <View className="gap-xl py-xl">
        <View className="gap-sm">
          <Text className="font-body-semibold text-label text-center tracking-label uppercase text-muted">
            Membership
          </Text>
          <Text
            accessibilityRole="header"
            className="font-display text-h1 text-center tracking-heading text-ink"
          >
            Atelier Access
          </Text>
          <Text className="font-body text-center text-base text-body">{intro}</Text>
        </View>

        {subscription.isError ? (
          <ErrorState
            title="Membership didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void subscription.refetch()}
          />
        ) : (
          <>
            <MembershipStatusRow state={membership} planTitle={currentPlan?.title ?? null} loading={subscription.isPending} />
            {!subscription.isPending ? <MembershipActions membership={membership} /> : null}
          </>
        )}

        <CreditsMeter
          balance={balance}
          allowance={credits.data?.allowance ?? null}
          loading={credits.isPending}
        />

        {plans.isPending ? (
          <LoadingState label="Loading membership plans" lines={4} />
        ) : null}

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
          <PlanCard
            key={plan.id}
            plan={plan}
            current={plan.id === currentPlan?.id}
          />
        ))}

        <Button
          label="Back"
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}
