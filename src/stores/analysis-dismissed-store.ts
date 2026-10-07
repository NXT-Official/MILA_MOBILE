import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { persistStorage } from "./persist-storage";

/** How many dismissed job ids are remembered; older ones fall off. */
export const DISMISSED_LIMIT = 20;

/**
 * The finished reads she has already dismissed, so a colour read, check-in or
 * body scan result is offered once. UI state, not server data: the last 20 job
 * ids, nothing else.
 */
type DismissedState = {
  ids: string[];
  dismiss: (id: string) => void;
};

export const useAnalysisDismissedStore = create<DismissedState>()(
  persist(
    (set) => ({
      ids: [],
      dismiss: (id) =>
        set((state) =>
          state.ids.includes(id) ? state : { ids: [...state.ids, id].slice(-DISMISSED_LIMIT) },
        ),
    }),
    {
      name: "mila-analysis-dismissed",
      storage: createJSONStorage(persistStorage),
      partialize: (state) => ({ ids: state.ids }),
    },
  ),
);
