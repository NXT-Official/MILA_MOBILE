import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { usePasswordReset } from "@/features/auth/hooks/use-auth-actions";
import { ResetRequest, type ResetRequestValues } from "@/lib/auth-input";

export default function ForgotPasswordScreen() {
  const [sent, setSent] = useState(false);
  const reset = usePasswordReset();

  const { control, handleSubmit, formState } = useForm<ResetRequestValues>({
    resolver: zodResolver(ResetRequest),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    // The confirmation is identical whether or not the address exists — telling
    // the member which is which is an account-enumeration oracle.
    await reset.mutateAsync(values.email).catch(() => undefined);
    setSent(true);
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
            <Button
              label="Send reset link"
              size="lg"
              loading={reset.isPending}
              disabled={!formState.isValid}
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
