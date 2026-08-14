import { router } from "expo-router";
import { Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Sheet } from "@/components/ui/Sheet";
import {
  formatBillingInterval,
  formatPlanPrice,
  useSubscriptionPlans,
} from "@/hooks/use-subscription-plans";

/**
 * The response to `INSUFFICIENT_CREDITS` — a sheet, never a toast (§7).
 *
 * This is the primary conversion moment in the product, and a toast that fades
 * after three seconds is how it gets missed. It is opened by the server's error
 * code and by nothing else: no screen inspects a local balance to decide
 * whether to show it.
 */
export function PaywallSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: plans, isPending, isError, refetch } = useSubscriptionPlans();

  return (
    <Sheet visible={visible} onClose={onClose} title="You're out of credits">
      <View className="gap-lg">
        <Text className="font-body text-base text-body">
          Credits refresh daily with a membership. Choose the one that fits how often you dress with
          Mila.
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
