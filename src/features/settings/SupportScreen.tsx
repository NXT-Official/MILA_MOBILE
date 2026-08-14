import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { InlineError } from "@/components/ui/ErrorState";
import { CaptchaGate, type CaptchaGateHandle } from "@/components/feedback/CaptchaGate";
import { resolveApiFailure } from "@/services/api/client";
import {
  MAX_SUPPORT_MESSAGE_LENGTH,
  sendSupportMessage,
  type SupportKind,
} from "@/services/api/support";
import { useThemeColor } from "@/theme/tailwind";
import { cn } from "@/utils/cn";

/**
 * Help and feedback.
 *
 * The endpoint is **unauthenticated**, which is why the captcha is not optional
 * here: with no session to rate-limit against, hCaptcha plus a
 * 3-per-15-minutes IP limit are the whole defence. A token is single-use, so
 * it is cleared after every attempt — reusing one fails for a reason the member
 * cannot act on.
 */
export function SupportScreen() {
  const [kind, setKind] = useState<SupportKind>("help");
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const captcha = useRef<CaptchaGateHandle>(null);
  const placeholderColor = useThemeColor("muted");

  const send = useMutation({
    retry: false,
    mutationFn: (token: string) =>
      sendSupportMessage({ kind, message: message.trim(), captchaToken: token }),
    onSettled: () => {
      // Success or failure, the token is spent.
      setCaptchaToken(null);
      captcha.current?.reset();
    },
    onSuccess: () => setMessage(""),
  });

  const ready = message.trim().length > 0 && !send.isPending;

  async function handleSend() {
    const token = captchaToken ?? (await captcha.current?.challenge()) ?? null;
    // A dismissed challenge is not an error — she simply closed it.
    if (!token) return;
    send.mutate(token);
  }

  return (
    <Screen scroll>
      <View className="gap-xl py-xl">
        <Text
          accessibilityRole="header"
          className="font-display text-h1 tracking-heading text-ink"
        >
          Help &amp; feedback
        </Text>

        <View className="flex-row gap-sm">
          <Chip label="Get help" selected={kind === "help"} onPress={() => setKind("help")} />
          <Chip
            label="Send feedback"
            selected={kind === "feedback"}
            onPress={() => setKind("feedback")}
          />
        </View>

        <View className="gap-sm">
          <Text className="font-body-medium text-sm text-ink">Your message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
            textAlignVertical="top"
            placeholder={
              kind === "help"
                ? "What went wrong, and what were you trying to do?"
                : "What would you change?"
            }
            placeholderTextColor={placeholderColor}
            accessibilityLabel="Your message"
            className="min-h-3xl w-full rounded-control border border-border bg-surface px-lg py-md font-body text-base text-ink dark:border-border/12"
          />
          <Text
            className={cn(
              "self-end font-body text-micro",
              message.length > MAX_SUPPORT_MESSAGE_LENGTH - 100 ? "text-ink" : "text-muted",
            )}
          >
            {message.length} / {MAX_SUPPORT_MESSAGE_LENGTH}
          </Text>
        </View>

        <CaptchaGate
          ref={captcha}
          verified={Boolean(captchaToken)}
          onChange={setCaptchaToken}
        />

        {send.isError ? <InlineError message={resolveApiFailure(send.error).message} /> : null}

        {send.isSuccess ? (
          <Text accessibilityLiveRegion="polite" className="font-body text-base text-body">
            Thank you — your message is with the studio. We answer by email.
          </Text>
        ) : null}

        <Button
          label="Send"
          disabled={!ready}
          loading={send.isPending}
          onPress={() => void handleSend()}
        />

        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
