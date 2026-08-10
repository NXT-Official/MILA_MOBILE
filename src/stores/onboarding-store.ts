import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { OnboardingStepId } from "@/constants/steps";
import type { StyleProfileUpdate } from "@/services/supabase/profile";
import type { StudioColorProfile } from "@/types/models";

/**
 * The one answer that has been given but not yet confirmed by the server.
 *
 * Deliberately NOT a mirror of the profile: once a write succeeds the answer
 * belongs to the `profile` query and is dropped from here. Two copies of the
 * same answer is how a resume shows stale data.
 *
 * It is persisted so a save that failed in a lift survives the app being
 * killed — that is the whole point of "a dropped connection never costs her
 * progress". AsyncStorage, not SecureStore: a body type is not a credential.
 */
export type PendingWrite = {
  step: OnboardingStepId;
  payload: StyleProfileUpdate;
};

type OnboardingState = {
  pending: PendingWrite | null;
  /**
   * The season chosen on `color-path`, waiting to be confirmed on
   * `color-result`.
   *
   * This CANNOT be component state. Each step is its own route, so advancing
   * mounts a fresh screen and any `useState` on the previous one is gone — the
   * member would confirm a palette that had already been discarded. The web
   * gets away with `useState` because it keeps one component mounted and only
   * swaps a `?step=` search param; a native stack does not work that way.
   *
   * Persisting it also means quitting between the two steps no longer costs
   * her the choice.
   */
  candidate: StudioColorProfile | null;
  /** False until the persisted draft has been read — a retry before then would send null. */
  hydrated: boolean;
  setPending: (pending: PendingWrite) => void;
  clearPending: () => void;
  setCandidate: (candidate: StudioColorProfile) => void;
  clearCandidate: () => void;
};

/**
 * What survives an app kill. Both entries are load-bearing: `pending` is the
 * answer a failed save is still holding, `candidate` is the season chosen but
 * not yet confirmed. Dropping either from here silently costs a member her
 * progress on a cold start.
 */
export const PERSISTED_KEYS = ["pending", "candidate"] as const;

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      pending: null,
      candidate: null,
      hydrated: false,
      setPending: (pending) => set({ pending }),
      clearPending: () => set({ pending: null }),
      setCandidate: (candidate) => set({ candidate }),
      clearCandidate: () => set({ candidate: null }),
    }),
    {
      name: "mila-onboarding-draft",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) =>
        Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]])) as Pick<
          OnboardingState,
          (typeof PERSISTED_KEYS)[number]
        >,
      onRehydrateStorage: () => (state) => {
        // Runs on success and on failure; a read error must not wedge the flow,
        // so it falls through to "no draft".
        useOnboardingStore.setState({
          hydrated: true,
          pending: state?.pending ?? null,
          candidate: state?.candidate ?? null,
        });
      },
    },
  ),
);
