import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { useAuthStore } from "@/stores/auth-store";
import { errorMessage } from "@/utils/error-message";

import { DeleteAccountSheet } from "./components/DeleteAccountSheet";
import { useExportData } from "./hooks/use-account-actions";

/**
 * Data export and account deletion.
 *
 * **Account deletion is reachable in the app** — an App Store requirement, not
 * a nicety, and one of the two known submission blockers recorded in
 * `platform/ios/README.md`.
 *
 * There is no platform code on this screen. The export writes and shares
 * through `services/files/`, which is exactly what that adapter exists for
 * (§12).
 */
export function PrivacyScreen() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const email = useAuthStore((s) => s.session?.user.email ?? "");

  const exportData = useExportData();

  return (
    <Screen scroll>
      <View className="gap-2xl py-xl">
        <Text
          accessibilityRole="header"
          className="font-display text-h1 tracking-heading text-ink"
        >
          Privacy &amp; data
        </Text>

        <View className="gap-md">
          <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
            Your data
          </Text>
          <Text className="font-body text-base text-body">
            A JSON file with your profile, saved looks, posts, palettes, and favourites. It opens in
            whichever app you choose to send it to.
          </Text>

          {exportData.isError ? (
            <InlineError
              message={errorMessage(exportData.error, "We couldn't build your export just now.")}
            />
          ) : null}

          {exportData.data === "shared" ? (
            <Text accessibilityLiveRegion="polite" className="font-body text-sm text-body">
              Your export is ready.
            </Text>
          ) : null}

          <Button
            label="Export my data"
            variant="secondary"
            loading={exportData.isPending}
            onPress={() => exportData.mutate()}
          />
        </View>

        <View className="gap-md">
          <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
            Leaving
          </Text>
          <Text className="font-body text-base text-body">
            Deleting your account removes everything, immediately and permanently. Export first if
            you want to keep any of it.
          </Text>

          <Button
            label="Delete my account"
            variant="destructive"
            onPress={() => setDeleteOpen(true)}
          />
        </View>

        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </View>

      <DeleteAccountSheet
        visible={deleteOpen}
        email={email}
        onClose={() => setDeleteOpen(false)}
      />
    </Screen>
  );
}
