import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { PASSWORD_MAX_LENGTH, passwordRuleResults } from "@/constants/password";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { useUpdatePassword } from "@/features/auth/hooks/use-auth-actions";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { errorMessage } from "@/utils/error-message";

type Stage = "verifying" | "invalid" | "ready" | "done";

/**
 * Extracts the recovery tokens Supabase appends after `#` on the
 * `mila://reset-password` redirect. There is no `window.location.hash` on a
 * native deep link, so this mirrors `useGoogleSignIn`'s own
 * `result.url.replace("#", "?")` parse rather than relying on
 * `detectSessionInUrl` (off — see `services/supabase/client.ts`).
 */
function parseRecoveryTokens(url: string): { access_token: string; refresh_token: string } | null {
  const params = new URL(url.replace("#", "?")).searchParams;
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (params.get("type") !== "recovery" || !accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

/**
 * Reached only via the `mila://reset-password` link Supabase emails from
 * `requestPasswordReset`. `setSession` below signs the member into a real
 * (temporary) session — `recovery` is latched in the auth store *before* that
 * call so the launch gate holds her here instead of racing her into the app;
 * see `resolveDestination` and the `Stack.Protected` block in `_layout.tsx`.
 */
export default function ResetPasswordScreen() {
  const url = Linking.useURL();
  const setRecovery = useAuthStore((s) => s.setRecovery);
  const [stage, setStage] = useState<Stage>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const claimed = useRef(false);
  const updatePassword = useUpdatePassword();

  // undefined: the deep link hasn't resolved yet. null: resolved, no usable
  // recovery tokens.
  const tokens = url === null ? undefined : parseRecoveryTokens(url);

  useEffect(() => {
    if (claimed.current || !tokens) return;
    claimed.current = true;
    setRecovery(true);
    supabase.auth.setSession(tokens).then(({ error }) => {
      setStage(error ? "invalid" : "ready");
    });
  }, [tokens, setRecovery]);

  const effectiveStage: Stage = tokens === null && stage === "verifying" ? "invalid" : stage;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordReady =
    passwordsMatch &&
    password.length <= PASSWORD_MAX_LENGTH &&
    passwordRuleResults(password).every((rule) => rule.met);

  const onSubmit = () => {
    updatePassword.mutate(password, {
      onSuccess: () => {
        setStage("done");
        setRecovery(false);
        // Explicit navigation, and the web is the reason: its form ends with
        // `navigate({ to: "/dashboard", replace: true })` after the same call.
        // LoginForm/SignupForm get away without one because they sit inside the
        // `(auth)` guard, which flips off the moment a session exists and
        // ejects them — this screen is deliberately outside every guard (the
        // deep link has to be able to mount it), so nothing moves her off it.
        // Without this she sat on "Password updated" forever.
        setTimeout(() => router.replace("/"), 900);
      },
    });
  };

  const backToSignIn = () => {
    setRecovery(false);
    // Let the gate decide, exactly as it does on a cold start: "/" resolves to
    // the tabs for a signed-in member and falls through to the (auth) group —
    // login — for a signed-out one. Hard-coding /login here would bounce a
    // signed-in member (an expired link opened while she is already in) off a
    // guard-protected screen.
    router.replace("/");
  };

  return (
    <Screen scroll>
      <AuthCard
        title="Choose a new password"
        subtitle="This link is single-use — set a password you'll remember."
        showTabs={false}
      >
        {effectiveStage === "verifying" ? (
          <View className="w-full items-center gap-md py-md">
            <Icon name="lock" size="lg" color="muted" />
            <Text className="font-body text-base text-body text-center">
              Verifying your reset link…
            </Text>
          </View>
        ) : null}

        {effectiveStage === "invalid" ? (
          <View className="w-full items-center gap-md py-md">
            <Icon name="alert" size="lg" color="destructive" />
            <Text className="font-body text-base text-body text-center">
              This reset link has expired or was already used. Request a new one from the sign-in
              screen.
            </Text>
            <Button
              label="Back to sign in"
              size="lg"
              onPress={backToSignIn}
              className="mt-sm w-full"
            />
          </View>
        ) : null}

        {effectiveStage === "ready" ? (
          <View className="w-full gap-lg">
            <Input
              label="New password"
              size="lg"
              placeholder="••••••••"
              revealable
              autoCapitalize="none"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
            />
            <Input
              label="Confirm new password"
              size="lg"
              placeholder="••••••••"
              revealable
              autoCapitalize="none"
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={
                confirmPassword.length > 0 && !passwordsMatch
                  ? "Passwords do not match."
                  : undefined
              }
            />
            <PasswordChecklist value={password} />

            {updatePassword.isError ? (
              <InlineError
                message={errorMessage(
                  updatePassword.error,
                  "Mila couldn't update your password.",
                )}
              />
            ) : null}

            <Button
              label="Update password"
              size="lg"
              loading={updatePassword.isPending}
              disabled={!passwordReady}
              onPress={onSubmit}
            />
          </View>
        ) : null}

        {effectiveStage === "done" ? (
          <View className="w-full items-center gap-md py-md">
            <Icon name="check" size="lg" color="success" />
            <Text className="font-body text-base text-body text-center">
              Password updated. Taking you to your studio…
            </Text>
          </View>
        ) : null}
      </AuthCard>
    </Screen>
  );
}
