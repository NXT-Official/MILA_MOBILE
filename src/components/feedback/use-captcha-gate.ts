import { useState } from "react";

import type { CaptchaGateHandle } from "@/components/feedback/CaptchaGate";

/**
 * A plain object a screen holds and the gate attaches itself to.
 *
 * Screens used to keep a ref to the gate and read `ref.current` inside their
 * submit callbacks. React Compiler cannot prove such a callback (passed through
 * `handleSubmit`) runs outside render, so it rejected the whole component or
 * forced a lint suppression. A controller is not a ref: `captcha.markUsed()` is
 * an ordinary method call, and the screen never touches `.current`.
 */
export type CaptchaController = {
  /** Called by the gate; screens never call these two. */
  attach: (handle: CaptchaGateHandle | null) => void;
  /** Opens the challenge; null if it did not complete or the gate is not mounted. */
  challenge: () => Promise<string | null>;
  reset: () => void;
  markUsed: () => void;
};

export function createCaptchaController(): CaptchaController {
  let handle: CaptchaGateHandle | null = null;
  return {
    attach: (next) => {
      handle = next;
    },
    challenge: async () => (await handle?.challenge()) ?? null,
    reset: () => handle?.reset(),
    markUsed: () => handle?.markUsed(),
  };
}

export function useCaptchaGate(): CaptchaController {
  const [controller] = useState(createCaptchaController);
  return controller;
}
