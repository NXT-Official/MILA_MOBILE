import { router } from "expo-router";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  formatBillingInterval,
  formatPlanPrice,
  useSubscriptionPlans,
} from "@/hooks/use-subscription-plans";
import type { SubscriptionPlan } from "@/services/supabase/plans";

/**
 * The plans, read-only. Checkout is Phase 09 (§15) — and until it exists there
 * is deliberately no purchase affordance here at all, not even a disabled one:
 * a button that cannot buy anything is a worse answer than a plain statement of
 * what each plan includes.
 *
 * Entitlement is never inferred from this screen. It comes from Supabase,
 * written by the Paddle webhook, and nothing on the device may decide it (§9).
 */
export function MembershipScreen() {
  const { data: plans, isPending, isError, refetch } = useSubscriptionPlans();

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

        {isPending ? <LoadingState label="Loading membership plans" lines={4} /> : null}

        {isError ? (
          <ErrorState
            title="Plans didn't load"
            description="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void refetch()}
          />
        ) : null}

        {plans?.length === 0 ? (
          <EmptyState
            icon="sparkle"
            title="No plans right now"
            description="Memberships are being updated. Try again shortly."
            actionLabel="Refresh"
            onAction={() => void refetch()}
          />
        ) : null}

        {plans?.map((plan) => <PlanCard key={plan.id} plan={plan} />)}

        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function PlanCard({ plan }: { plan: SubscriptionPlan }) {
  return (
    <Card>
      <View className="gap-md">
        <View className="flex-row items-start justify-between gap-md">
          <Text className="font-display text-h3 text-ink">{plan.title}</Text>
          {plan.is_featured ? <Badge label="Most popular" variant="accent" /> : null}
        </View>

        <View className="flex-row items-baseline gap-sm">
          <Text className="font-display text-h2 tracking-heading text-ink">
            {formatPlanPrice(plan.price_amount, plan.currency)}
          </Text>
          <Text className="font-body text-sm text-body">
            {formatBillingInterval(plan.billing_interval)}
          </Text>
        </View>

        <Text className="font-body text-base text-body">{plan.description}</Text>

        <View className="flex-row items-center gap-sm">
          <Icon name="sparkle" size="sm" color="accent" />
          <Text className="font-body-medium text-sm text-ink">
            {plan.credits_included} credits a day
          </Text>
        </View>

        {plan.features.map((feature) => (
          <View key={feature} className="flex-row items-start gap-sm">
            <View className="mt-xs">
              <Icon name="check" size="xs" color="muted" />
            </View>
            <Text className="flex-1 font-body text-sm text-body">{feature}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
