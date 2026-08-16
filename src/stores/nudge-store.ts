import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Nudges she has waved off. UI state, not server state — a dismissal is a
 * statement about this device's noise level, not a property of the member, so
 * it never becomes a profile column.
 *
 * Persisted, because a nudge that returns on every cold start is not a nudge.
 * One dismissal and it stays gone: a member who has decided against beauty
 * preferences is not asked twice.
 */
type NudgeState = {
  dossierDismissed: boolean;
  dismissDossier: () => void;
  /** False until the persisted value has been read — nudges wait on this. */
  hydrated: boolean;
};

export const useNudgeStore = create<NudgeState>()(
  persist(
    (set) => ({
      dossierDismissed: false,
      dismissDossier: () => set({ dossierDismissed: true }),
      hydrated: false,
    }),
    {
      name: "mila-nudges",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ dossierDismissed: state.dossierDismissed }),
      onRehydrateStorage: () => (state) => {
        // Runs on success and on failure. Rendering before this lands would
        // flash a dismissed card on every cold start.
        useNudgeStore.setState({
          hydrated: true,
          dossierDismissed: state?.dossierDismissed ?? false,
        });
      },
    },
  ),
);
