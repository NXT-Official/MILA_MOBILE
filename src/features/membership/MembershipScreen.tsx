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
 * **No checkout, permanently.** Appendix D.1 (Paddle hosted checkout vs.
 * native IAP) is decided: Paddle stays web-only. Purchase, cancel, and resume
 * live exclusively on the web app, and mobile shows entitlement status
 * read-only. This is not a stopgap pending App Store/Play Store IAP review —
 * there is no purchase affordance here at all, not even a disabled one, and
 * none is planned. A disabled or "coming soon" CTA would advertise a mobile
 * checkout that is not coming.
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
            Choose Your Atelier Access
          </Text>
          <Text className="font-body text-center text-base text-body">
            Select the membership that best fits the way you want to style,
            explore, and create with Mila.
          </Text>
        </View>

        <MembershipStatusRow
          state={membership}
          planTitle={currentPlan?.title ?? null}
          loading={subscription.isPending}
        />

        <CreditsMeter balance={balance} loading={credits.isPending} />

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
