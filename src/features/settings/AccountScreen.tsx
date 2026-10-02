import { router } from "expo-router";
import { useRef, useState } from "react";
import { Text, View } from "react-native";

import { CaptchaGate, type CaptchaGateHandle } from "@/components/feedback/CaptchaGate";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaGateHandle>(null);

  const changeEmail = useChangeEmail();
  const changePassword = useChangePassword();

  // The same rules the checklist renders, so the button never disagrees with
  // what she can see above it.
  const passwordReady =
    currentPassword.length > 0 &&
    newPassword.length <= PASSWORD_MAX_LENGTH &&
    passwordRuleResults(newPassword).every((rule) => rule.met) &&
    newPassword === confirmPassword &&
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
            Signed in as {currentEmail}. Check both your old and new inboxes to confirm an email
            change. Your address changes only after confirmation.
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
              Check both your old and new inboxes for confirmation links.
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

          <Input
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            revealable
            autoCapitalize="none"
            textContentType="newPassword"
            error={confirmPassword && confirmPassword !== newPassword ? "Passwords don't match." : undefined}
          />

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

          {/* The re-auth is a password grant, and this project rejects those
              without an hCaptcha token (`captcha_failed`) — without the gate a
              correct current password reads as wrong. Same shape as sign-in. */}
          <CaptchaGate ref={captcha} verified={Boolean(captchaToken)} onChange={setCaptchaToken} />

          <Button
            label="Change password"
            disabled={!passwordReady || !captchaToken}
            loading={changePassword.isPending}
            onPress={() => {
              if (!captchaToken) return;
              changePassword.mutate(
                { currentPassword, newPassword, captchaToken },
                {
                  onSuccess: () => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  },
                  // A token is single-use — reset the gate after every attempt,
                  // pass or fail, matching sign-in.
                  onSettled: () => {
                    captcha.current?.reset();
                    setCaptchaToken(null);
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
