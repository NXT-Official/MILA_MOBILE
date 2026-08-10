import { useCallback, useEffect } from "react";
import { AppState } from "react-native";

import type { OnboardingStepId } from "@/constants/steps";
import { useUpdateStyleProfile } from "@/hooks/use-profile";
import type { StyleProfileUpdate } from "@/services/supabase/profile";
import { useOnboardingStore } from "@/stores/onboarding-store";

import type { SaveState } from "../components/SaveStatus";

/**
 * Autosave after every answer, never a batch at the end.
 *
 * The sequence is: record the answer as pending → write it → drop it. If the
 * write fails, the answer stays in the persisted draft and the member stays on
 * the step with her selection intact, so the only thing she lost is the round
 * trip. Replay happens on an explicit tap, on the next mount, and when the app
 * returns to the foreground.
 *
 * ponytail: foreground is the reconnect proxy — toggling airplane mode almost
 * always means leaving and returning to the app. For a true
 * connectivity-restored trigger, add `@react-native-community/netinfo` and call
 * `retry()` from its listener; nothing else here changes.
 */
export function useAutoSaveProfile(step: OnboardingStepId) {
  const mutation = useUpdateStyleProfile();
  const pending = useOnboardingStore((s) => s.pending);
  const hydrated = useOnboardingStore((s) => s.hydrated);

  // Only this step's own draft is ever replayed. Flushing another step's
  // pending answer from here would write it without the member seeing where.
  const mine = pending?.step === step ? pending : null;

  const mutateAsync = mutation.mutateAsync;

  /** Saves one answer. Resolves true on success; the caller advances only then. */
  const save = useCallback(
    async (payload: StyleProfileUpdate): Promise<boolean> => {
      useOnboardingStore.getState().setPending({ step, payload });
      try {
        await mutateAsync(payload);
        useOnboardingStore.getState().clearPending();
        return true;
      } catch {
        // The message is rendered by SaveStatus, not thrown at the member — a
        // Postgres error string is not something she can act on.
        return false;
      }
    },
    [step, mutateAsync],
  );

  /**
   * Reads the draft from the store rather than from the render's closure, so
   * the AppState listener never replays a stale payload and the effect below
   * does not need to re-subscribe on every keystroke.
   */
  const retry = useCallback(() => {
    const draft = useOnboardingStore.getState().pending;
    if (draft?.step === step) void save(draft.payload);
  }, [step, save]);

  // Replay a draft left behind by a previous session, once the persisted store
  // has rehydrated. Keyed on `hydrated` alone: re-running on every change to
  // `pending` would spin a failing write in a loop.
  useEffect(() => {
    if (hydrated) retry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") retry();
    });
    return () => subscription.remove();
  }, [retry]);

  const state: SaveState = mutation.isPending
    ? "saving"
    : mutation.isError
      ? "error"
      : mine
        ? "dirty"
        : mutation.isSuccess
          ? "saved"
          : "idle";

  return { save, retry, state, saving: mutation.isPending };
}
