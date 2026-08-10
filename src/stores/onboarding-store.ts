import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { OnboardingStepId } from "@/constants/steps";
import type { StyleProfileUpdate } from "@/services/supabase/profile";

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
  /** False until the persisted draft has been read — a retry before then would send null. */
  hydrated: boolean;
  setPending: (pending: PendingWrite) => void;
  clearPending: () => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      pending: null,
      hydrated: false,
      setPending: (pending) => set({ pending }),
      clearPending: () => set({ pending: null }),
    }),
    {
      name: "mila-onboarding-draft",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ pending: state.pending }),
      onRehydrateStorage: () => (state) => {
        // Runs on success and on failure; a read error must not wedge the flow,
        // so it falls through to "no draft".
        useOnboardingStore.setState({ hydrated: true, pending: state?.pending ?? null });
      },
    },
  ),
);
