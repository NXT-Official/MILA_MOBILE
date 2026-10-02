import { Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import {
  formatBillingInterval,
  formatPlanPrice,
  normalizePlanFeatures,
} from "@/lib/subscription-plans";
import type { SubscriptionPlan } from "@/services/supabase/plans";

/**
 * One plan. Single column — never the web's three-column grid, which on a phone
 * becomes three unreadable slivers or a horizontal scroll nobody finds.
 *
 * **At most one plan is featured**, and that is enforced by a partial unique
 * index in the database. This renders whatever the row says and does not
 * re-check it: a second client-side rule is a second thing to disagree with.
 *
 * Purchase controls require a configured store product and server receipt
 * verification (§9). The existing Paddle price is informational; it is never
 * used to guess a Google Play or App Store product or its localized price.
 */
export function PlanCard({
  plan,
  current = false,
}: {
  plan: SubscriptionPlan;
  /** The member's active plan, read from the subscription row — never inferred. */
  current?: boolean;
}) {
  const features = normalizePlanFeatures(plan.features);

  return (
    <Card>
      <View className="gap-md">
        <View className="flex-row items-start justify-between gap-md">
          <Text className="flex-1 font-display text-h3 text-ink">{plan.title}</Text>
          {current ? (
            <Badge label="Your plan" variant="success" />
          ) : plan.is_featured ? (
            <Badge label="Recommended" variant="accent" />
          ) : null}
        </View>

        <View className="flex-row items-baseline gap-sm">
          <Text className="font-display text-h2 tracking-heading text-ink">
            {formatPlanPrice(plan.price_amount, plan.currency)}
          </Text>
          <Text className="font-body text-sm text-body">
            {formatBillingInterval(plan.billing_interval)}
          </Text>
        </View>

        {plan.description ? (
          <Text className="font-body text-base text-body">{plan.description}</Text>
        ) : null}

        <View className="gap-sm border-t border-border pt-lg dark:border-border/12">
          {plan.credits_included > 0 ? (
            <View className="flex-row items-center gap-sm">
              <Icon name="sparkle" size="sm" color="accent" />
              <Text className="font-body-medium text-sm text-ink">
                {plan.credits_included} styling credits per day
              </Text>
            </View>
          ) : null}

          {features.map((feature) => (
            <View key={feature} className="flex-row items-start gap-sm">
              <View className="mt-xs">
                <Icon name="check" size="xs" color="muted" />
              </View>
              <Text className="flex-1 font-body text-sm text-body">{feature}</Text>
            </View>
          ))}

          <View className="flex-row items-start gap-sm">
            <View className="mt-xs">
              <VerifiedBadge />
            </View>
            <Text className="flex-1 font-body text-sm text-body">
              Verified badge on your profile and posts
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}
