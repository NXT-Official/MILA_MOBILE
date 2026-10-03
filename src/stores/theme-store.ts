import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { persistStorage } from "./persist-storage";

export type ThemePreference = "light" | "dark" | "system";

type ThemeState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** False until the persisted value has been read — the splash waits on this. */
  hydrated: boolean;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      setPreference: (preference) => set({ preference }),
      hydrated: false,
    }),
    {
      name: "mila-theme",
      storage: createJSONStorage(persistStorage),
      partialize: (state) => ({ preference: state.preference }),
      onRehydrateStorage: () => (state) => {
        // Runs on success and on failure; a read error must not hold the splash
        // forever, so the app falls through to "system".
        useThemeStore.setState({ hydrated: true, preference: state?.preference ?? "system" });
      },
    },
  ),
);
