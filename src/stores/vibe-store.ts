import { create } from "zustand";

import { DEFAULT_VIBE, type Vibe } from "@/constants/vibes";

/**
 * The occasion she is dressing for today. UI state, not server state — the vibe
 * is an input to a generation, never a property of the member, so nothing here
 * mirrors a row and there is no key to invalidate.
 *
 * Not persisted: it is a statement about *today*, and restoring last Tuesday's
 * "Formal Event" on a Sunday morning is worse than starting from the default.
 */
type VibeState = {
  vibe: Vibe;
  setVibe: (vibe: Vibe) => void;
};

export const useVibeStore = create<VibeState>((set) => ({
  vibe: DEFAULT_VIBE,
  setVibe: (vibe) => set({ vibe }),
}));
