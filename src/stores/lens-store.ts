import { create } from "zustand";

/**
 * Whether the Studio Lens sheet is open.
 *
 * A store rather than a `useState` because two controls open the same sheet —
 * the Lens tab and the header — and the sheet is mounted once above the
 * navigator, so it also works on the screens that have no tab bar. Client-only
 * UI state, nothing persisted (§6).
 */
type LensState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const useLensStore = create<LensState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
