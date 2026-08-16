import ConfirmHcaptcha from "@hcaptcha/react-native-hcaptcha";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { CAPTCHA_BASE_URL, CAPTCHA_SITEKEY } from "@/services/captcha";

export type CaptchaGateHandle = {
  /** Opens the challenge. Resolves with a token, or null if it did not complete. */
  challenge: () => Promise<string | null>;
  reset: () => void;
};

/**
 * hCaptcha is a hard requirement, not a nicety: this Supabase project has
 * captcha protection enabled, so `signInWithPassword` without a token is
 * rejected server-side with `captcha_failed`.
 *
 * A token is single-use and short-lived, so it is cleared after every attempt —
 * success or failure. Reusing one produces a failure the member cannot act on.
 */
export const CaptchaGate = forwardRef<CaptchaGateHandle, { verified: boolean; onChange: (token: string | null) => void }>(
  function CaptchaGate({ verified, onChange }, ref) {
    const widget = useRef<ConfirmHcaptcha>(null);
    const resolver = useRef<((token: string | null) => void) | null>(null);
    const [pending, setPending] = useState(false);

    const settle = (token: string | null) => {
      setPending(false);
      widget.current?.hide();
      onChange(token);
      resolver.current?.(token);
      resolver.current = null;
    };

    useImperativeHandle(ref, () => ({
      challenge: () =>
        new Promise<string | null>((resolve) => {
          resolver.current = resolve;
          setPending(true);
          widget.current?.show();
        }),
      reset: () => {
        onChange(null);
        resolver.current = null;
      },
    }));

    const onMessage = (event: { nativeEvent: { data: string } }) => {
      const data = event.nativeEvent.data;
      // The library reports outcomes as bare strings; anything else is a token.
      if (data === "cancel" || data === "error" || data === "expired") return settle(null);
      if (data === "open") return;
      settle(data);
    };

    return (
      <View className="w-full">
        <ConfirmHcaptcha
          ref={widget}
          siteKey={CAPTCHA_SITEKEY}
          // hCaptcha refuses to run on localhost; the WebView needs a real
          // https origin matching the sitekey's allowed hostnames.
          baseUrl={CAPTCHA_BASE_URL}
          languageCode="en"
          onMessage={onMessage}
          size="invisible"
          // The library's own wrapper is react-native's `SafeAreaView`, which
          // RN 0.86 deprecates and warns about on every challenge. `false`
          // swaps it for a plain View; nothing is lost, because the wrapper
          // sits inside a full-screen Modal and centres the challenge box
          // vertically — it never reaches an inset. Revisit if the package
          // moves to `react-native-safe-area-context` (latest is 4.1.0).
          useSafeAreaView={false}
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: verified, busy: pending }}
          accessibilityLabel="Verify you are human"
          onPress={() => {
            if (verified) return;
            setPending(true);
            widget.current?.show();
          }}
          className="w-full flex-row items-center gap-md rounded-control border border-border bg-surface px-lg py-md dark:border-border/12"
        >
          <View
            className={
              verified
                ? "h-6 w-6 items-center justify-center rounded-control bg-success"
                : "h-6 w-6 items-center justify-center rounded-control border border-border dark:border-border/12"
            }
          >
            {verified ? <Icon name="check" size="xs" color="onInk" /> : null}
          </View>
          <Text className="flex-1 font-body text-base text-ink">
            {verified ? "Verified" : pending ? "Opening challenge…" : "I am human"}
          </Text>
          <Text className="font-body text-micro text-muted">hCaptcha</Text>
        </Pressable>
      </View>
    );
  },
);
