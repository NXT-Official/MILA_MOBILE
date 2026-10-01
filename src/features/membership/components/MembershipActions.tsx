import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Sheet } from "@/components/ui/Sheet";
import { queryKeys } from "@/constants/query-keys";
import { useCountdown } from "@/hooks/use-countdown";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { formatPeriodDate, type MembershipState } from "@/lib/subscription-status";
import { cancelMembership, resumeMembership } from "@/services/api/billing";
import { resolveApiFailure } from "@/services/api/errors";
import { useAuthStore } from "@/stores/auth-store";

type Action = "cancel" | "resume";

/** Native confirmation; access and renewal dates always come from the server. */
export function MembershipActions({ membership }: { membership: MembershipState }) {
  // A plan staff granted by hand is not billed through Paddle, so there is
  // nothing to cancel or resume: calling the endpoints would only fail. The
  // notice beside the status row explains it (STAFF_GRANTED_SUBSCRIPTION_NOTICE).
  if (membership.staffGranted) return null;

  return <ManageMembership membership={membership} />;
}

function ManageMembership({ membership }: { membership: MembershipState }) {
  const [action, setAction] = useState<Action | null>(null);
  const [limitedUntil, setLimitedUntil] = useState<number | null>(null);
  const limitedFor = useCountdown(limitedUntil);
  const { online } = useNetworkStatus();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const mutation = useMutation({
    mutationFn: async (choice: Action) => {
      if (!userId) throw new Error("Sign in to manage your membership.");
      return choice === "cancel" ? cancelMembership() : resumeMembership();
    },
    retry: false,
    onSuccess: async () => {
      setAction(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.mySubscription(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) }),
      ]);
    },
    onError: (error) => {
      const failure = resolveApiFailure(error);
      if (failure.kind === "rate-limited") {
        setLimitedUntil(Date.now() + (failure.retryAfterSeconds ?? 60) * 1000);
      }
    },
  });
  const blocked = !online || limitedFor > 0 || !userId;
  const choice = membership.headline === "ends" ? "resume" : "cancel";
  const date = formatPeriodDate(membership.date);
  // The dates the server just wrote — never a date the app worked out. The
  // endpoint returns the period end it scheduled (cancel) or the renewal it
  // restored (resume), and that is what the member is told.
  const settled =
    mutation.isSuccess && mutation.data
      ? formatPeriodDate("endsAt" in mutation.data ? mutation.data.endsAt : mutation.data.renewsAt)
      : null;

  return (
    <View className="gap-md">
      {mutation.isSuccess ? (
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-body">
          {mutation.variables === "cancel"
            ? settled
              ? `Cancellation scheduled. Your access continues until ${settled}.`
              : "Cancellation scheduled. Your access continues until the end of your billing period."
            : settled
              ? `Your membership will renew on ${settled}.`
              : "Your membership will renew again."}
        </Text>
      ) : null}
      {mutation.isError && action === null ? <InlineError message={resolveApiFailure(mutation.error).message} /> : null}
      {membership.inForce && !membership.staffGranted ? (
        <Button
          label={choice === "cancel" ? "Cancel membership" : "Resume membership"}
          variant="secondary"
          disabled={blocked}
          loading={mutation.isPending}
          onPress={() => {
            mutation.reset();
            setAction(choice);
          }}
        />
      ) : null}
      {!online ? <InlineError message="Connect to the internet to manage your membership." /> : null}
      {limitedFor > 0 ? <InlineError message={`Try again in ${limitedFor} seconds.`} /> : null}
      <Sheet
        visible={action !== null}
        onClose={() => setAction(null)}
        title={action === "resume" ? "Resume membership?" : "Cancel membership?"}
      >
        <View className="gap-lg">
          <Text className="font-body text-base text-body">
            {action === "resume"
              ? date ? `Your membership will renew on ${date} at your current plan price.` : "Your membership will renew automatically at your current plan price."
              : date ? `Your access continues until ${date}. You will not be charged for the next period.` : "Your access continues until the end of your billing period. You will not be charged for the next period."}
          </Text>
          {mutation.isError ? <InlineError message={resolveApiFailure(mutation.error).message} /> : null}
          {!online ? <InlineError message="Connect to the internet to continue." /> : null}
          <Button
            label={mutation.isError ? "Try again" : action === "resume" ? "Resume membership" : "Confirm cancellation"}
            disabled={blocked}
            loading={mutation.isPending}
            onPress={() => { if (action && !blocked && !mutation.isPending) mutation.mutate(action); }}
          />
          <Button label="Not now" variant="secondary" disabled={mutation.isPending} onPress={() => setAction(null)} />
        </View>
      </Sheet>
    </View>
  );
}
