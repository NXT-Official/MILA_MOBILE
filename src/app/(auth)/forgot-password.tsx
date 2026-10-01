import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";

import { CaptchaGate, type CaptchaGateHandle } from "@/components/feedback/CaptchaGate";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { usePasswordReset } from "@/features/auth/hooks/use-auth-actions";
import { ResetRequest, type ResetRequestValues } from "@/lib/auth-input";
import { errorMessage } from "@/utils/error-message";

export default function ForgotPasswordScreen() {
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const captcha = useRef<CaptchaGateHandle>(null);
  const reset = usePasswordReset();

  const { control, handleSubmit } = useForm<ResetRequestValues>({
    resolver: zodResolver(ResetRequest),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!captchaToken) return;
    setFormError(null);

    try {
      await reset.mutateAsync({ email: values.email, captchaToken });
      // The confirmation is identical whether or not the address exists —
      // telling the member which is which is an account-enumeration oracle.
      // The service swallows not-found, so anything caught here is a real
      // failure (a rejected captcha, a dead network) and is surfaced.
      setSent(true);
    } catch (error) {
      setFormError(errorMessage(error, "Mila couldn't send that email. Please try again."));
    } finally {
      // A token is single-use and short-lived: reset after every attempt.
      captcha.current?.reset();
      setCaptchaToken(null);
    }
  });

  return (
    <Screen scroll>
      <AuthCard
        title="Reset your password"
        subtitle="We'll email you a link to choose a new one."
        showTabs={false}
      >
        {sent ? (
          <View className="w-full items-center gap-md py-md">
            <Icon name="mail" size="lg" color="accent" />
            <Text className="font-body text-base text-body text-center">
              If that address is registered, a reset link is on its way. Check your inbox.
            </Text>
            <Button
              label="Back to sign in"
              variant="secondary"
              size="lg"
              onPress={() => router.replace("/login")}
              className="mt-sm w-full"
            />
          </View>
        ) : (
          <View className="w-full gap-lg">
            <Controller
              control={control}
              name="email"
              render={({ field, fieldState }) => (
                <Input
                  label="Email Address"
                  size="lg"
                  placeholder="name@studio.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <CaptchaGate
              ref={captcha}
              verified={Boolean(captchaToken)}
              onChange={setCaptchaToken}
            />

            {formError ? <InlineError message={formError} /> : null}

            <Button
              label="Send reset link"
              size="lg"
              loading={reset.isPending}
              // The captcha token is the only gate, matching sign-in: under
              // `onTouched` a valid form stays "invalid" until a blur, and
              // dismissing the keyboard does not blur on Android.
              disabled={!captchaToken}
              onPress={onSubmit}
            />
            <Button
              label="Back to sign in"
              variant="ghost"
              onPress={() => router.replace("/login")}
            />
          </View>
        )}
      </AuthCard>
    </Screen>
  );
}
