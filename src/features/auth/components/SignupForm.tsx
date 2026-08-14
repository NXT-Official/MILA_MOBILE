import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { SignupForm as SignupSchema, type SignupFormValues } from "@/lib/auth-input";
import { ApiError } from "@/services/api/client";
import { UNIFORM_AUTH_FAILURE } from "@/services/api/auth";

import { useSignUp } from "../hooks/use-auth-actions";
import { CaptchaGate, type CaptchaGateHandle } from "@/components/feedback/CaptchaGate";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";

export function SignupForm() {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const captcha = useRef<CaptchaGateHandle>(null);
  const signUp = useSignUp();

  const { control, handleSubmit } = useForm<SignupFormValues>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { username: "", email: "", password: "" },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  // useWatch, not watch(): watch() returns a fresh function each render, which
  // makes React Compiler skip memoising this whole component.
  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    if (!captchaToken) return;
    setFormError(null);

    try {
      await signUp.mutateAsync({ ...values, captchaToken });
      router.replace("/");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : UNIFORM_AUTH_FAILURE);
    } finally {
      setCaptchaToken(null);
      captcha.current?.reset();
    }
  });

  return (
    <View className="w-full gap-lg">
      {formError ? <InlineError message={formError} /> : null}

      <Controller
        control={control}
        name="username"
        render={({ field, fieldState }) => (
          <Input
            label="Studio Username"
            size="lg"
            placeholder="atelier_handle"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />

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
            textContentType="emailAddress"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />

      <View className="gap-md">
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Input
              label="Security Password"
              size="lg"
              placeholder="••••••••"
              revealable
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
        <PasswordChecklist value={password} />
      </View>

      <CaptchaGate ref={captcha} verified={Boolean(captchaToken)} onChange={setCaptchaToken} />

      <Button
        label="Create Atelier Account"
        size="lg"
        loading={signUp.isPending}
        // Captcha is the only gate — see the note in LoginForm.
        disabled={!captchaToken}
        onPress={onSubmit}
      />
    </View>
  );
}
