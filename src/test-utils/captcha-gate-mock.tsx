/**
 * Test stand-in for the hCaptcha gate.
 *
 * The real gate embeds a WebView challenge that cannot mint a token under
 * jest, so this mock exposes the same imperative handle and hands the screen
 * a fixed token on press. Kept in its own module because a jest.mock factory
 * may only reference `require` — the nativewind transform rewrites element
 * creation into out-of-scope helpers the jest hoist check rejects.
 */
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { Pressable } from "react-native";

export const CaptchaGate = forwardRef<
  { challenge: () => Promise<string | null>; reset: () => void; markUsed: () => void },
  {
    verified: boolean;
    onChange: (token: string | null) => void;
    controller?: {
      attach: (handle: { challenge: () => Promise<string | null>; reset: () => void; markUsed: () => void } | null) => void;
    };
  }
>(function MockCaptchaGate({ onChange, controller }, ref) {
  const handle = {
    challenge: async () => null,
    reset: () => onChange(null),
    markUsed: () => undefined,
  };
  useImperativeHandle(ref, () => handle);
  useEffect(() => {
    controller?.attach(handle);
    return () => controller?.attach(null);
  });
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="Verify you are human"
      onPress={() => onChange("test-token")}
    />
  );
});
