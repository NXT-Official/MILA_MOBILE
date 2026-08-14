import { create } from "zustand";

import type { CapturedPhoto } from "@/services/camera";

/**
 * The dual-capture session.
 *
 * This one earns a store where the Lens capture did not: the session spans two
 * camera steps and a review step, and the member can leave and come back
 * between them. A `useState` in the capture screen would lose a good full-body
 * shot the moment the screen remounted.
 *
 * **Not persisted.** A half-finished OOTD from yesterday is not something to
 * restore into — and the URIs point at cache files the OS may already have
 * reclaimed. Client-only, no server data (§6).
 */
export type CaptureStep = "back" | "front" | "review";

type CaptureState = {
  step: CaptureStep;
  back: CapturedPhoto | null;
  front: CapturedPhoto | null;
  caption: string;
  setBack: (photo: CapturedPhoto) => void;
  setFront: (photo: CapturedPhoto) => void;
  setCaption: (caption: string) => void;
  /** Step back one, for the review screen's "retake" affordances. */
  goTo: (step: CaptureStep) => void;
  reset: () => void;
};

const EMPTY = { step: "back" as CaptureStep, back: null, front: null, caption: "" };

export const useCaptureStore = create<CaptureState>((set) => ({
  ...EMPTY,
  // Each capture advances the step itself, so the screen never has to remember
  // what comes next — there is one description of the order, and it is here.
  setBack: (back) => set({ back, step: "front" }),
  setFront: (front) => set({ front, step: "review" }),
  setCaption: (caption) => set({ caption }),
  goTo: (step) => set({ step }),
  reset: () => set(EMPTY),
}));
