import ConfirmHcaptcha from "@hcaptcha/react-native-hcaptcha";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { CAPTCHA_BASE_URL, CAPTCHA_SITEKEY } from "@/services/captcha";

export type CaptchaGateHandle = {
  /** Opens the challenge. Resolves with a token, or null if it did not complete. */
  challenge: () => Promise<string | null>;
  reset: () => void;
  /**
   * The token has been spent (sent to the server). The library fires `expired`
   * on its own clock whether or not the token was used, so after this a late
   * expiry is ignored instead of showing a "timed out" notice for a check that
   * already did its job. `reset` implies it.
   */
  markUsed: () => void;
};

/**
 * What the member is told after a challenge that did not produce a token. A
 * challenge she closed herself is not one of these: backing out needs no
 * message, the checkbox just goes back to the start.
 */
type Notice = "failed" | "expired";

const NOTICE_COPY: Record<Notice, string> = {
  failed: "Couldn't check that. Tap to try again.",
  expired: "That check timed out. Tap to try again.",
};

/** The library's message event, narrowed to the two fields the gate reads. */
type CaptchaMessage = { nativeEvent: { data: string }; success?: boolean };

/**
 * The library reports every outcome through one channel as a bare string: the
 * token on success, otherwise a name such as `challenge-closed` or
 * `network-error`. It marks a token with `success: true` (and `open` with it
 * too, which the caller has already ruled out); its own `cancel` and
 * loading-timeout events carry no `success` at all.
 *
 * `success` alone is not enough: the library also flags any long enough message
 * as a token, including a script-load error sentence. A token is one unbroken
 * string, so anything with whitespace in it is an error message, not a token.
 */
function isToken(event: CaptchaMessage): boolean {
  return event.success === true && /^\S+$/.test(event.nativeEvent.data);
}

/**
 * hCaptcha is a hard requirement, not a nicety: this Supabase project has
 * captcha protection enabled, so `signInWithPassword` without a token is
 * rejected server-side with `captcha_failed`.
 *
 * A token is single-use and short-lived, so it is cleared after every attempt —
 * success or failure. Reusing one produces a failure the member cannot act on.
 *
 * Only a success event carrying a token reads as verified. Every other message
 * settles `null`, so a closed challenge or a dropped connection can never be
 * mistaken for a token and sent to sign-in.
 */
export const CaptchaGate = forwardRef<CaptchaGateHandle, { verified: boolean; onChange: (token: string | null) => void }>(
  function CaptchaGate({ verified, onChange }, ref) {
    const widget = useRef<ConfirmHcaptcha>(null);
    const resolver = useRef<((token: string | null) => void) | null>(null);
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState<Notice | null>(null);
    // True from a token being issued until it is spent or cleared.
    const holdingToken = useRef(false);

    const settle = (token: string | null, next: Notice | null = null) => {
      holdingToken.current = token !== null;
      setPending(false);
      setNotice(next);
      widget.current?.hide();
      onChange(token);
      resolver.current?.(token);
      resolver.current = null;
    };

    const open = () => {
      setNotice(null);
      setPending(true);
      widget.current?.show();
    };

    useImperativeHandle(ref, () => ({
      challenge: () =>
        new Promise<string | null>((resolve) => {
          resolver.current = resolve;
          open();
        }),
      reset: () => {
        holdingToken.current = false;
        onChange(null);
        resolver.current = null;
      },
      markUsed: () => {
        holdingToken.current = false;
      },
    }));

    const onMessage = (event: CaptchaMessage) => {
      const data = event.nativeEvent.data;
      if (data === "open") return;
      if (isToken(event)) return settle(data);
      if (data === "cancel" || data === "challenge-closed") return settle(null);
      if (data === "expired") {
        // Nothing live to expire: no open challenge and no unspent token.
        if (!holdingToken.current && !resolver.current) return;
        return settle(null, "expired");
      }
      settle(null, "failed");
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
            open();
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
            {verified ? (
              <Icon name="check" size="xs" color="onInk" />
            ) : notice ? (
              <Icon name="alert" size="xs" color="destructive" />
            ) : null}
          </View>
          <Text accessibilityLiveRegion="polite" className="flex-1 font-body text-base text-ink">
            {verified
              ? "Verified"
              : pending
                ? "Opening challenge…"
                : notice
                  ? NOTICE_COPY[notice]
                  : "I am human"}
          </Text>
          <Text className="font-body text-micro text-muted">hCaptcha</Text>
        </Pressable>
      </View>
    );
  },
);
