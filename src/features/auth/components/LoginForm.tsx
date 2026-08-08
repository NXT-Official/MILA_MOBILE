import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { CredentialsForm, type CredentialsFormValues } from "@/lib/auth-input";
import { UNIFORM_AUTH_FAILURE } from "@/services/api/auth";

import { useSignIn } from "../hooks/use-auth-actions";
import { CaptchaGate, type CaptchaGateHandle } from "./CaptchaGate";

export function LoginForm() {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const captcha = useRef<CaptchaGateHandle>(null);
  const signIn = useSignIn();

  const { control, handleSubmit } = useForm<CredentialsFormValues>({
    resolver: zodResolver(CredentialsForm),
    defaultValues: { email: "", password: "" },
    // Errors appear after a field has been touched, then track every keystroke.
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!captchaToken) return;
    setFormError(null);

    try {
      await signIn.mutateAsync({ ...values, captchaToken });
      router.replace("/");
    } catch {
      // Always the uniform message — never distinguish which field was wrong.
      setFormError(UNIFORM_AUTH_FAILURE);
    } finally {
      // The token is single-use: clear it after every attempt, pass or fail.
      setCaptchaToken(null);
      captcha.current?.reset();
    }
  });

  return (
    <View className="w-full gap-lg">
      {formError ? <InlineError message={formError} /> : null}

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
            autoComplete="current-password"
            textContentType="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />

      <Link href="/forgot-password" asChild>
        <Text
          accessibilityRole="link"
          className="self-end font-body text-sm text-body underline"
        >
          Forgot password?
        </Text>
      </Link>

      <CaptchaGate ref={captcha} verified={Boolean(captchaToken)} onChange={setCaptchaToken} />

      <Button
        label="Enter Mila Studio"
        size="lg"
        loading={signIn.isPending}
        // The captcha token is the ONLY gate (§3). Do not also gate on
        // formState.isValid: under `onTouched` it stays false until a field is
        // blurred, and dismissing the keyboard does not blur a TextInput on
        // Android — so a member who fills both fields and solves the captcha
        // is left staring at a dead button. handleSubmit validates on press
        // and surfaces field errors there instead.
        disabled={!captchaToken}
        onPress={onSubmit}
      />
    </View>
  );
}
