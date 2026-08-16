import { router } from "expo-router";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { InlineError } from "@/components/ui/ErrorState";
import { SettingsList, SettingsRow } from "@/components/ui/SettingsList";
import { useSignOut } from "@/hooks/use-sign-out";
import { hubById } from "@/services/weather";
import { useProfile } from "@/hooks/use-profile";
import { useAuthStore } from "@/stores/auth-store";
import { useState } from "react";

import { ThemeToggle } from "./components/ThemeToggle";

/**
 * The settings menu — a list, not a grid (§10).
 *
 * No admin, moderation, role, or staff row exists here or anywhere below it.
 * Mobile is a member application; those surfaces must not exist in this
 * codebase in any form.
 */
export function SettingsScreen() {
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const email = useAuthStore((s) => s.session?.user.email ?? null);
  const { data: profile } = useProfile();
  const signOut = useSignOut();

  const hub = hubById(profile?.default_location);

  return (
    <Screen scroll>
      <View className="gap-xl py-xl">
        <Text
          accessibilityRole="header"
          className="font-display text-h1 tracking-heading text-ink"
        >
          Settings
        </Text>

        <SettingsList>
          <SettingsRow
            icon="mail"
            label="Account"
            value={email ?? undefined}
            onPress={() => router.push("/settings/account")}
          />
          <SettingsRow
            icon="location"
            label="Default location"
            value={hub?.city ?? "Not set"}
            onPress={() => router.push("/settings/location")}
          />
          <SettingsRow
            icon="secure"
            label="Privacy & data"
            value="Export or delete your account"
            onPress={() => router.push("/settings/privacy")}
          />
          <SettingsRow
            icon="help"
            label="Help & feedback"
            onPress={() => router.push("/settings/support")}
          />
        </SettingsList>

        <View className="gap-md">
          <Text
            accessibilityRole="header"
            className="font-body-semibold text-section tracking-section uppercase text-muted"
          >
            Appearance
          </Text>
          <ThemeToggle />
        </View>

        <SettingsList>
          <SettingsRow
            icon="sparkle"
            label="Membership"
            onPress={() => router.push("/membership")}
          />
        </SettingsList>

        {signOut.isError ? (
          <InlineError message="Mila couldn't sign you out. Please try again." />
        ) : null}

        <Button
          label="Sign out"
          variant="secondary"
          loading={signOut.isPending}
          onPress={() => setConfirmSignOut(true)}
        />

        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </View>

      <ConfirmSheet
        visible={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title="Sign out?"
        message="Your dossier and everything you have saved stay on your account."
        confirmLabel="Sign out"
        loading={signOut.isPending}
        onConfirm={() => {
          setConfirmSignOut(false);
          signOut.mutate();
        }}
      />
    </Screen>
  );
}
