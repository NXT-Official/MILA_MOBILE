/**
 * "I don't understand what I'm supposed to do in the app" — answered in three
 * lines, at the top of Home.
 *
 * Home used to open on statistics: a style-profile percentage and a count of
 * looks. Neither tells a member what to do next. This module is the pure part:
 * given three signals it produces the three moves, in the order they happen,
 * each with the copy that makes it actionable — and it is the same three moves
 * the web dashboard shows, because the product is the same product.
 *
 * Copy rules: no gamification, no streaks, no exclamation marks (§10), and the
 * profile step speaks only about the seven core questions — the optional extras
 * are opt-in and must never read as a to-do.
 */

/** Storage key for the dismissal. Namespaced so it can never collide with zustand's own keys. */
export const GETTING_STARTED_DISMISS_KEY = "mila.getting-started.dismissed";

export interface GettingStartedInput {
  /** 0–100, the same nine-field score `lib/dashboard-stats.ts` computes. */
  profilePercent: number;
  hasPhotoConsent: boolean;
  hasComposedLook: boolean;
}

export interface GettingStartedStep {
  id: "profile" | "photo" | "look";
  title: string;
  hint: string;
  /** Label for the affordance. Always present — a step without a verb is not actionable. */
  cta: string;
  /**
   * Where the affordance goes. Absent means the target is on this screen, below
   * the card, and the step renders its label as a hint instead of a button.
   */
  route?: string;
  done: boolean;
}

/**
 * The three moves, in the order they happen. A member who does them in order
 * never hits the generator with an empty profile or no photo.
 */
export function gettingStartedSteps(input: GettingStartedInput): GettingStartedStep[] {
  return [
    {
      id: "profile",
      title: "Finish your style profile",
      hint: "The seven questions are all Mila needs. Everything after them is optional.",
      cta: "Open style profile",
      route: "/studio",
      // Exactly 100: the score rounds, and 99% is a member who still has a
      // required field open.
      done: input.profilePercent >= 100,
    },
    {
      id: "photo",
      title: "Add a selfie",
      hint: "One clear photo lets Mila read your colouring and try a look on you.",
      cta: "Add it in the card below",
      done: input.hasPhotoConsent,
    },
    {
      id: "look",
      title: "Compose today's look",
      hint: "Pick a vibe and press Generate — Mila writes the outfit for your weather.",
      cta: "Start it in the card below",
      done: input.hasComposedLook,
    },
  ];
}

export interface GettingStartedProgress {
  done: number;
  total: number;
  percent: number;
  allDone: boolean;
}

export function gettingStartedProgress(steps: GettingStartedStep[]): GettingStartedProgress {
  const total = steps.length;
  const done = steps.filter((step) => step.done).length;
  return {
    done,
    total,
    percent: total === 0 ? 100 : Math.round((done / total) * 100),
    // An empty checklist is not a finished one — it is a bug, and the card
    // should not congratulate anybody for it.
    allDone: total > 0 && done === total,
  };
}

/** The first unfinished step, or null when the member is done. Drives "Start here". */
export function nextGettingStartedStep(steps: GettingStartedStep[]): GettingStartedStep | null {
  return steps.find((step) => !step.done) ?? null;
}

/**
 * The slice of AsyncStorage the dismissal needs. Injectable so the behaviour is
 * testable without a native module, and so a caller can pass the no-op store
 * `persistStorage()` returns during the web export's static render.
 */
export interface DismissalStore {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

/**
 * A storage that throws (private mode, a full disk) must never break Home —
 * worst case the card reappears next launch, which is the safe direction.
 */
export async function readGettingStartedDismissed(store: DismissalStore): Promise<boolean> {
  try {
    return (await store.getItem(GETTING_STARTED_DISMISS_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function writeGettingStartedDismissed(store: DismissalStore): Promise<void> {
  try {
    await store.setItem(GETTING_STARTED_DISMISS_KEY, "1");
  } catch {
    // Nothing to recover: the dismissal is a preference, not state.
  }
}
