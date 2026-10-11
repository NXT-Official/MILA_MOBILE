import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { CreditsMeter } from "@/components/ui/CreditsMeter";
import { SettingsList, SettingsRow } from "@/components/ui/SettingsList";
import { Sheet } from "@/components/ui/Sheet";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { useCreditBalance, useCredits } from "@/hooks/use-credits";
import { useMySubscription } from "@/hooks/use-my-subscription";
import { useProfile } from "@/hooks/use-profile";
import { useSignOut } from "@/hooks/use-sign-out";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import { formatPeriodDate, resolveMembership } from "@/lib/subscription-status";

/**
 * The header avatar's destination — the web's membership drawer, as a sheet.
 *
 * On web the avatar opens a drawer holding who she is, where her membership
 * stands, and the way into everything else. Mobile used to push `/settings`
 * instead, which lost the identity summary and made the account feel like a
 * preferences list. Same content, same order, presented the way every dialog in
 * this app is presented (§10).
 *
 * Entitlement is read, never computed (§7): the plan title and the renewal date
 * come from the row the Paddle webhook wrote, and nothing here branches on the
 * balance.
 *
 * Sign out is in the title row, because the sheet's content is taller than its
 * detent and anything at the foot is below the fold.
 */
export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const signOut = useSignOut();
  const { data: profile } = useProfile();
  const subscription = useMySubscription();
  const plans = useSubscriptionPlans();
  const credits = useCredits();
  const balance = useCreditBalance();

  const membership = resolveMembership(subscription.data);
  const planTitle =
    plans.data?.find((plan) => plan.id === subscription.data?.plan_id)?.title ?? null;
  const renewal = formatPeriodDate(membership.date);

  // Her name as she gave it, else her username, else a plain "Member". Never her
  // sign-in address: the front of an email is neither a name nor a handle, and
  // showing it as one hands her private login back as public identity.
  const username = profile?.username?.trim() || null;
  const name = profile?.full_name?.trim() || username || "Member";
  const monogram = name[0].toUpperCase();

  function go(href: Parameters<typeof router.push>[0]) {
    onClose();
    router.push(href);
  }

  return (
    <>
      <Sheet
        visible={visible && !confirmSignOut}
        onClose={onClose}
        title="Your account"
        height="80%"
        headerAction={
          <Button
            label="Sign out"
            icon="signOut"
            variant="secondary"
            onPress={() => {
              signOut.reset();
              setConfirmSignOut(true);
              onClose();
            }}
          />
        }
      >
        <View className="gap-lg">
          <View className="gap-md rounded-card border border-border bg-surface p-lg dark:border-border/12">
            <View className="flex-row items-center gap-md">
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="h-3xl w-3xl items-center justify-center rounded-pill bg-ink"
              >
                <Text className="font-display text-h2 text-on-ink">{monogram}</Text>
              </View>

              <View className="min-w-0 flex-1 gap-xs">
                <View className="flex-row items-center gap-sm">
                  <Text numberOfLines={1} className="font-display text-h3 text-ink">
                    {name}
                  </Text>
                  {membership.inForce ? <VerifiedBadge /> : null}
                </View>
                {username ? (
                  <Text numberOfLines={1} className="font-body text-sm text-muted">
                    @{username}
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="flex-row flex-wrap gap-sm">
              <Fact label="Season" value={profile?.color_season} />
              <Fact label="Face" value={profile?.face_shape} />
              <Fact label="Hair" value={profile?.hair_type} />
            </View>
          </View>

          <CreditsMeter
            balance={balance}
            allowance={credits.data?.allowance ?? null}
            loading={credits.isPending}
          />

          <SettingsList>
            <SettingsRow
              icon="sparkle"
              label="Membership"
              value={
                membership.headline === "renews" && renewal
                  ? `${planTitle ?? "Member"} · renews ${renewal}`
                  : membership.headline === "ends" && renewal
                    ? `${planTitle ?? "Member"} · ends ${renewal}`
                    : membership.headline === "lapsed"
                      ? "Ended — view plans"
                      : "Free tier"
              }
              onPress={() => go("/membership")}
            />
            <SettingsRow
              icon="studio"
              label="Colour dossier"
              value="Your season and its palette"
              onPress={() => go("/profile")}
            />
            <SettingsRow
              icon="bookmark"
              label="Outfit archive"
              value="Every look you have analysed"
              onPress={() => go("/history")}
            />
            <SettingsRow
              icon="bookmarkCheck"
              label="Saved pieces"
              value="Pieces Mila recommended that you kept"
              onPress={() => go("/saved")}
            />
            <SettingsRow icon="settings" label="Settings" onPress={() => go("/settings")} />
          </SettingsList>
        </View>
      </Sheet>

      {/*
        Sign out hands over to a confirmation the way ConversationSheet's delete
        does: the account sheet is closed for the header outright (so "Not now"
        can never re-present it mid-dismiss), and the confirmation is driven by
        state here, so it stays up on its own. On success the auth guard swaps
        to sign-in and unmounts all of this; on failure the reason shows in the
        confirmation and the button is live.
      */}
      <ConfirmSheet
        visible={confirmSignOut}
        onClose={() => {
          setConfirmSignOut(false);
          signOut.reset();
        }}
        title="Sign out?"
        message="Your dossier and everything you have saved stay on your account."
        confirmLabel="Sign out"
        loading={signOut.isPending}
        error={signOut.isError ? "Mila couldn't sign you out. Please try again." : null}
        onConfirm={() => signOut.mutate()}
      />
    </>
  );
}

/**
 * One dossier fact as a pill. An unset attribute says so in words — the
 * Colour-Is-Content rule (§10) applies to a gap as much as to a status.
 */
function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="rounded-pill border border-border bg-canvas px-md py-xs dark:border-border/12">
      <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
        {label} · <Text className={value ? "text-ink" : "text-muted"}>{value || "Not set"}</Text>
      </Text>
    </View>
  );
}
