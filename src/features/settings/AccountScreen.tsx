import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { PASSWORD_MAX_LENGTH, passwordRuleResults } from "@/constants/password";
import { useAuthStore } from "@/stores/auth-store";
import { errorMessage } from "@/utils/error-message";

import { useChangeEmail, useChangePassword } from "./hooks/use-account-actions";

/**
 * Change email, change password.
 *
 * Both are credential changes, so neither is optimistic and neither claims
 * success it cannot see: an email change is a *sent confirmation*, not a
 * change, and saying otherwise is how a member concludes the app is broken when
 * her old address still works.
 */
export function AccountScreen() {
  const currentEmail = useAuthStore((s) => s.session?.user.email ?? "");

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const changeEmail = useChangeEmail();
  const changePassword = useChangePassword();

  // The same rules the checklist renders, so the button never disagrees with
  // what she can see above it.
  const passwordReady =
    currentPassword.length > 0 &&
    newPassword.length <= PASSWORD_MAX_LENGTH &&
    passwordRuleResults(newPassword).every((rule) => rule.met) &&
    newPassword !== currentPassword;

  return (
    <Screen scroll>
      <View className="gap-2xl py-xl">
        <Text
          accessibilityRole="header"
          className="font-display text-h1 tracking-heading text-ink"
        >
          Account
        </Text>

        <View className="gap-md">
          <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
            Email
          </Text>
          <Text className="font-body text-sm text-body">
            Signed in as {currentEmail}. Changing this sends a confirmation to the new address — it
            takes effect only once you open that link.
          </Text>

          <Input
            label="New email"
            value={email}
            onChangeText={setEmail}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />

          {changeEmail.isError ? (
            <InlineError message={errorMessage(changeEmail.error, "That didn't work.")} />
          ) : null}

          {changeEmail.isSuccess ? (
            <Text accessibilityLiveRegion="polite" className="font-body text-sm text-body">
              Check {email} for the confirmation link.
            </Text>
          ) : null}

          <Button
            label="Send confirmation"
            disabled={!email.trim() || email.trim() === currentEmail}
            loading={changeEmail.isPending}
            onPress={() => changeEmail.mutate(email.trim())}
          />
        </View>

        <View className="gap-md">
          <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
            Password
          </Text>
          <Text className="font-body text-sm text-body">
            Your current password is required — a session alone is not enough to change it.
          </Text>

          <Input
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            revealable
            autoCapitalize="none"
            textContentType="password"
          />

          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            revealable
            autoCapitalize="none"
            textContentType="newPassword"
          />

          <PasswordChecklist value={newPassword} />

          {changePassword.isError ? (
            <InlineError
              message={errorMessage(changePassword.error, "We couldn't change your password.")}
            />
          ) : null}

          {changePassword.isSuccess ? (
            <Text accessibilityLiveRegion="polite" className="font-body text-sm text-body">
              Your password is updated.
            </Text>
          ) : null}

          <Button
            label="Change password"
            disabled={!passwordReady}
            loading={changePassword.isPending}
            onPress={() => {
              changePassword.mutate(
                { currentPassword, newPassword },
                {
                  onSuccess: () => {
                    setCurrentPassword("");
                    setNewPassword("");
                  },
                },
              );
            }}
          />
        </View>

        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
