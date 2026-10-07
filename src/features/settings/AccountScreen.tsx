import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { CaptchaGate } from "@/components/feedback/CaptchaGate";
import { useCaptchaGate } from "@/components/feedback/use-captcha-gate";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { PASSWORD_MAX_LENGTH, passwordRuleResults } from "@/constants/password";
import { useAuthStore } from "@/stores/auth-store";

import { useChangeEmail, useChangePassword } from "./hooks/use-account-actions";

const EMAIL_UNUSABLE = "That email can't be used for this account. Try a different one.";
const EMAIL_INVALID = "That email doesn't look right. Check it and try again.";
const SLOW_DOWN = "You've tried that a few times. Wait a little while, then try again.";
const SIGN_IN_AGAIN = "Please sign in again, then try once more.";
const NETWORK = "Mila couldn't reach the studio. Check your connection and try again.";
const EMAIL_FALLBACK = "We couldn't send that confirmation. Please try again.";
const PASSWORD_FALLBACK = "We couldn't change your password. Please try again.";

/**
 * The identity provider's error codes, in plain words. The provider's own
 * message is never shown: "already been registered" tells a signed-in member
 * whether another address has an account, and the rest read as faults.
 * `EMAIL_UNUSABLE` stays deliberately neutral for the same reason.
 */
// src: https://supabase.com/docs/guides/auth/debugging/error-codes · @supabase/auth-js 2.112.2 · 2026-10-06
const AUTH_ERROR_COPY = new Map<string, string>([
  ["email_exists", EMAIL_UNUSABLE],
  ["email_conflict_identity_not_possible", EMAIL_UNUSABLE],
  ["email_address_not_authorized", EMAIL_UNUSABLE],
  ["email_address_invalid", EMAIL_INVALID],
  ["over_email_send_rate_limit", SLOW_DOWN],
  ["over_request_rate_limit", SLOW_DOWN],
  ["same_password", "Choose a password you haven't used on this account before."],
  [
    "weak_password",
    "That password is too easy to guess. Try a longer one with letters, numbers and symbols.",
  ],
  ["reauthentication_needed", SIGN_IN_AGAIN],
  ["session_expired", SIGN_IN_AGAIN],
  ["session_not_found", SIGN_IN_AGAIN],
]);

/**
 * The only sentences `useChangePassword` words itself (its re-auth step). They
 * are matched exactly: this is an allow-list, so an error from anywhere else,
 * whatever its text, can never reach her.
 */
const PASSWORD_APP_MESSAGES = new Set([
  "That current password isn't right.",
  "That human check didn't go through — verify again and retry.",
  "You need to be signed in to change your password.",
]);

function codeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof Error && error.name === "AuthRetryableFetchError";
}

/** Only ever the provider's error, so nothing but a mapped code or the fallback is shown. */
function changeEmailMessage(error: unknown): string {
  if (isNetworkFailure(error)) return NETWORK;
  const code = codeOf(error);
  if (code === "validation_failed") return EMAIL_INVALID;
  return (code && AUTH_ERROR_COPY.get(code)) || EMAIL_FALLBACK;
}

function changePasswordMessage(error: unknown): string {
  if (isNetworkFailure(error)) return NETWORK;
  const code = codeOf(error);
  const mapped = code ? AUTH_ERROR_COPY.get(code) : undefined;
  if (mapped) return mapped;
  if (error instanceof Error && PASSWORD_APP_MESSAGES.has(error.message)) return error.message;
  return PASSWORD_FALLBACK;
}

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
  const captcha = useCaptchaGate();

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
            <InlineError message={changeEmailMessage(changeEmail.error)} />
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
            <InlineError message={changePasswordMessage(changePassword.error)} />
          ) : null}

          {changePassword.isSuccess ? (
            <Text accessibilityLiveRegion="polite" className="font-body text-sm text-body">
              Your password is updated.
            </Text>
          ) : null}

          {/* The re-auth is a password grant, and this project rejects those
              without an hCaptcha token (`captcha_failed`) — without the gate a
              correct current password reads as wrong. Same shape as sign-in. */}
          <CaptchaGate controller={captcha} verified={Boolean(captchaToken)} onChange={setCaptchaToken} />

          <Button
            label="Change password"
            disabled={!passwordReady || !captchaToken}
            loading={changePassword.isPending}
            onPress={() => {
              if (!captchaToken) return;
              captcha.markUsed();
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
                    captcha.reset();
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
