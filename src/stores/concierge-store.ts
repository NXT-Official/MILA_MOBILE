import { create } from "zustand";

/**
 * The anchored look, and nothing else.
 *
 * A member taps "Ask Mila" on a saved look and lands in a chat about it. The
 * anchor has to survive that navigation, which is why it is a store rather than
 * a route param — and it is UI state, not server data: the look itself lives in
 * `outfits` and TanStack Query already owns it.
 *
 * **Not persisted.** An anchor is about what she is looking at right now; on a
 * cold start there is nothing to be anchored to.
 */
export type ConciergeLook = {
  id: string;
  imageUrl: string | null;
  headline: string;
};

export const useConciergeStore = create<{
  anchoredLook: ConciergeLook | null;
  anchor: (look: ConciergeLook) => void;
  clear: () => void;
}>((set) => ({
  anchoredLook: null,
  anchor: (look) => set({ anchoredLook: look }),
  clear: () => set({ anchoredLook: null }),
}));
