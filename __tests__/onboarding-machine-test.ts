import {
  COUNTED_STEPS,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_IDS,
  getFirstIncompleteOnboardingStep,
  getOnboardingStepIndex,
  isOnboardingStepComplete,
  isOnboardingStepReachable,
  sanitizeOnboardingStep,
  type OnboardingStepId,
} from "@/constants/steps";
import { SEASONS, UNDERTONES } from "@/constants/style-profile";
import {
  nextStep,
  previousStep,
  resolveStep,
  undertoneForSeason,
} from "@/features/onboarding/machine";
import { isStyleProfileComplete, toStyleProfileRow } from "@/lib/style-profile/completion";
import { PERSISTED_KEYS, useOnboardingStore } from "@/stores/onboarding-store";
import type { DashboardProfile } from "@/types/models";

/**
 * The resume contract. A member who closes the app at 7:41am must reopen it on
 * the step she left, with her answers intact — these tests are what stop a
 * refactor from silently sending her back to step one.
 */

const BLANK: DashboardProfile = {
  body_type: null,
  color_season: null,
  color_season_base: null,
  skin_undertone: null,
  full_name: null,
  face_shape: null,
  hair_type: null,
  gender: null,
  hair_length: null,
  makeup_preference: null,
  shopping_preferences: null,
  styling_constraints: null,
  delivery_country: null,
  beauty_preferences: null,
  color_profile: null,
  default_location: null,
  style_goals: [],
  suspended: false,
  photo_consent_at: null,
  profile_photo_path: null,
  skin_depth: null,
  height_cm: null,
  weight_kg: null,
};

const withColor: DashboardProfile = {
  ...BLANK,
  skin_undertone: "Warm",
  color_season_base: "Autumn",
  color_season: "Autumn True",
  color_profile: { season: "Autumn" },
};
const withGender: DashboardProfile = { ...withColor, gender: "Female" };
const withSkinDepth: DashboardProfile = { ...withGender, skin_depth: "Medium" };
const withBody: DashboardProfile = { ...withSkinDepth, body_type: "Hourglass" };
const withFace: DashboardProfile = { ...withBody, face_shape: "Oval" };
const withHair: DashboardProfile = { ...withFace, hair_type: "Wavy" };
const withHairLength: DashboardProfile = { ...withHair, hair_length: "Medium" };

describe("step order", () => {
  it("is the sixteen steps in the documented order", () => {
    expect(ONBOARDING_STEP_IDS).toEqual([
      "welcome",
      "color-path",
      "color-result",
      "gender",
      "skin-depth",
      "body-type",
      "measurements",
      "face-shape",
      "hair-type",
      "hair-length",
      "makeup-preference",
      "beauty-preferences",
      "location",
      "shopping-preferences",
      "styling-constraints",
      "review",
    ]);
  });

  it("counts fifteen steps, never welcome", () => {
    expect(COUNTED_STEPS).toHaveLength(15);
    expect(COUNTED_STEPS.map((s) => s.id)).not.toContain("welcome");
  });

  it("reads 'Step 1 of 15' on the first counted step", () => {
    expect(getOnboardingStepIndex("color-path") + 1).toBe(1);
    expect(getOnboardingStepIndex("review") + 1).toBe(COUNTED_STEPS.length);
  });

  it("has no index for welcome, so the progress bar can hide itself", () => {
    expect(getOnboardingStepIndex("welcome")).toBe(-1);
  });

  it("marks exactly the six skippable steps optional", () => {
    expect(ONBOARDING_STEPS.filter((s) => s.optional).map((s) => s.id)).toEqual([
      "measurements",
      "makeup-preference",
      "beauty-preferences",
      "location",
      "shopping-preferences",
      "styling-constraints",
    ]);
  });
});

describe("sanitizeOnboardingStep", () => {
  it("accepts every known id", () => {
    for (const id of ONBOARDING_STEP_IDS) expect(sanitizeOnboardingStep(id)).toBe(id);
  });

  it("rejects anything else, so a hand-typed deep link cannot render a blank screen", () => {
    for (const value of ["", "Welcome", "step-1", "../review", 3, null, undefined, {}]) {
      expect(sanitizeOnboardingStep(value)).toBeUndefined();
    }
  });
});

describe("next / previous", () => {
  it("walks the full order forwards and back", () => {
    expect(nextStep("welcome")).toBe("color-path");
    expect(nextStep("hair-type")).toBe("hair-length");
    expect(nextStep("review")).toBeNull();
    expect(previousStep("color-path")).toBe("welcome");
    expect(previousStep("welcome")).toBeNull();
  });

  it("skips makeup-preference for a makeup-ineligible member, both ways", () => {
    // The web's `SELECT_STEPS["hair-length"].next` and `BeautyPreferencesStep.onBack`.
    const male = { gender: "Male" };
    expect(nextStep("hair-length", male)).toBe("beauty-preferences");
    expect(previousStep("beauty-preferences", male)).toBe("hair-length");

    // Everyone else keeps the linear order.
    const female = { gender: "Female" };
    expect(nextStep("hair-length", female)).toBe("makeup-preference");
    expect(previousStep("beauty-preferences", female)).toBe("makeup-preference");
  });

  it("is a bijection over the step list", () => {
    for (const [i, step] of ONBOARDING_STEPS.entries()) {
      const forward = nextStep(step.id);
      if (forward) expect(previousStep(forward)).toBe(step.id);
      else expect(i).toBe(ONBOARDING_STEPS.length - 1);
    }
  });
});

describe("isOnboardingStepComplete", () => {
  it("treats welcome, color-path, and every optional step as always complete", () => {
    for (const id of [
      "welcome",
      "color-path",
      "measurements",
      "makeup-preference",
      "beauty-preferences",
      "location",
      "shopping-preferences",
      "styling-constraints",
    ] as const) {
      expect(isOnboardingStepComplete(id, BLANK)).toBe(true);
    }
  });

  it("gates each answer step on its own field", () => {
    expect(isOnboardingStepComplete("color-result", BLANK)).toBe(false);
    expect(isOnboardingStepComplete("color-result", withColor)).toBe(true);
    expect(isOnboardingStepComplete("gender", withColor)).toBe(false);
    expect(isOnboardingStepComplete("gender", withGender)).toBe(true);
    expect(isOnboardingStepComplete("skin-depth", withGender)).toBe(false);
    expect(isOnboardingStepComplete("skin-depth", withSkinDepth)).toBe(true);
    expect(isOnboardingStepComplete("body-type", withSkinDepth)).toBe(false);
    expect(isOnboardingStepComplete("body-type", withBody)).toBe(true);
    expect(isOnboardingStepComplete("face-shape", withBody)).toBe(false);
    expect(isOnboardingStepComplete("face-shape", withFace)).toBe(true);
    expect(isOnboardingStepComplete("hair-type", withFace)).toBe(false);
    expect(isOnboardingStepComplete("hair-type", withHair)).toBe(true);
    expect(isOnboardingStepComplete("hair-length", withHair)).toBe(false);
    expect(isOnboardingStepComplete("hair-length", withHairLength)).toBe(true);
  });

  it("gates review on all seven required answers", () => {
    expect(isOnboardingStepComplete("review", withHair)).toBe(false);
    expect(isOnboardingStepComplete("review", withHairLength)).toBe(true);
  });

  it("rejects a colour answer that is outside the taxonomy", () => {
    expect(
      isOnboardingStepComplete("color-result", {
        ...withColor,
        skin_undertone: "warm",
      }),
    ).toBe(false);
  });
});

describe("getFirstIncompleteOnboardingStep", () => {
  it.each([
    [BLANK, "welcome"],
    [withColor, "gender"],
    [withGender, "skin-depth"],
    [withSkinDepth, "body-type"],
    [withBody, "face-shape"],
    [withFace, "hair-type"],
    [withHair, "hair-length"],
    [withHairLength, "beauty-preferences"],
  ] as const)("resumes at %#: %s", (profile, expected) => {
    expect(getFirstIncompleteOnboardingStep(profile)).toBe(expected);
  });

  it("sends a member with answers but no colour back to color-path, not welcome", () => {
    // Welcome is only for a genuinely blank profile — re-showing the intro to
    // someone mid-flow reads as lost progress even when nothing was lost.
    expect(getFirstIncompleteOnboardingStep({ ...BLANK, body_type: "Hourglass" })).toBe(
      "color-path",
    );
  });

  it("treats null and undefined as blank rather than throwing", () => {
    expect(getFirstIncompleteOnboardingStep(null)).toBe("welcome");
    expect(getFirstIncompleteOnboardingStep(undefined)).toBe("welcome");
  });
});

describe("isOnboardingStepReachable", () => {
  it("always allows welcome and color-path", () => {
    expect(isOnboardingStepReachable("welcome", BLANK)).toBe(true);
    expect(isOnboardingStepReachable("color-path", BLANK)).toBe(true);
  });

  it("blocks a jump past an incomplete required step", () => {
    expect(isOnboardingStepReachable("body-type", BLANK)).toBe(false);
    expect(isOnboardingStepReachable("review", withFace)).toBe(false);
    // `hair-length` is required and sits before makeup and beauty — a profile
    // that stopped at hair-type cannot jump over it.
    expect(isOnboardingStepReachable("makeup-preference", withHair)).toBe(false);
    expect(isOnboardingStepReachable("review", withHair)).toBe(false);
  });

  it("does not block on an incomplete OPTIONAL step", () => {
    // The six optional steps are skippable; requiring any of them would make
    // "I'll do this later" a dead end.
    expect(isOnboardingStepReachable("review", withHairLength)).toBe(true);
    expect(isOnboardingStepReachable("location", withHairLength)).toBe(true);
    expect(isOnboardingStepReachable("face-shape", withBody)).toBe(true);
  });

  it("lets a member walk back to any step she has already answered", () => {
    for (const id of ONBOARDING_STEP_IDS) {
      expect(isOnboardingStepReachable(id, withHairLength)).toBe(true);
    }
  });
});

describe("resolveStep", () => {
  it("keeps a reachable requested step", () => {
    expect(resolveStep("face-shape", withBody)).toEqual({ step: "face-shape", redirected: false });
  });

  it("redirects a deep link past an incomplete step to the resume point", () => {
    expect(resolveStep("review", BLANK)).toEqual({ step: "welcome", redirected: true });
    expect(resolveStep("hair-type", withColor)).toEqual({ step: "gender", redirected: true });
  });

  it("redirects when no step was requested at all", () => {
    expect(resolveStep(undefined, withBody)).toEqual({ step: "face-shape", redirected: true });
  });

  it("never returns an unreachable step, for any step against any profile", () => {
    const profiles = [
      BLANK,
      withColor,
      withGender,
      withSkinDepth,
      withBody,
      withFace,
      withHair,
      withHairLength,
    ];
    const requests: (OnboardingStepId | undefined)[] = [...ONBOARDING_STEP_IDS, undefined];
    for (const profile of profiles) {
      for (const requested of requests) {
        const { step } = resolveStep(requested, profile);
        expect(isOnboardingStepReachable(step, profile)).toBe(true);
      }
    }
  });
});

describe("undertoneForSeason", () => {
  it("maps the warm families to Warm and the rest to Cool", () => {
    expect(undertoneForSeason("Spring")).toBe("Warm");
    expect(undertoneForSeason("Autumn")).toBe("Warm");
    expect(undertoneForSeason("Summer")).toBe("Cool");
    expect(undertoneForSeason("Winter")).toBe("Cool");
  });

  it("always produces a value the completion gate accepts", () => {
    // This is the whole point of the function: `skin_undertone` is one of the
    // required fields, and the colour step is the only thing that writes it.
    for (const season of SEASONS) {
      expect(UNDERTONES as readonly string[]).toContain(undertoneForSeason(season));
    }
  });
});

describe("the colour candidate survives a step change", () => {
  /**
   * Each onboarding step is its own route, so advancing UNMOUNTS the screen.
   * The season chosen on `color-path` therefore cannot live in component state
   * — it did, and every season landed on "No colour result yet" because the
   * new screen mounted with nothing. The web only gets away with `useState`
   * because it swaps a `?step=` search param on one mounted component.
   */
  const season = {
    season: "Autumn",
    subSeason: "Autumn True",
    primarySwatches: [{ hex: "#8b5a2b", name: "Chestnut" }],
  };

  beforeEach(() => {
    useOnboardingStore.setState({ pending: null, candidate: null, hydrated: true });
  });

  it("keeps the candidate across a simulated unmount/remount", () => {
    useOnboardingStore.getState().setCandidate(season as never);
    // Nothing about a remount touches the store, which is the whole point.
    expect(useOnboardingStore.getState().candidate).toEqual(season);
  });

  it("drops the candidate once it has been confirmed to the server", () => {
    useOnboardingStore.getState().setCandidate(season as never);
    useOnboardingStore.getState().clearCandidate();
    // Two sources for one answer is how a later visit shows a stale palette.
    expect(useOnboardingStore.getState().candidate).toBeNull();
  });

  it("persists the candidate, so quitting between the two steps costs nothing", () => {
    // partialize decides what reaches AsyncStorage; omitting `candidate` would
    // make a cold start into color-result show the empty state again.
    expect(PERSISTED_KEYS).toContain("candidate");
    expect(PERSISTED_KEYS).toContain("pending");
  });
});

describe("the launch gate must not eject her mid-flow", () => {
  /**
   * Answering the LAST required question (hair length) completes the profile.
   * The launch gate re-reads completeness on every profile change, so without
   * a latch that answer throws her straight to Home — she never sees makeup,
   * beauty preferences, location, or the review.
   */
  beforeEach(() => {
    useOnboardingStore.setState({ pending: null, candidate: null, active: false, hydrated: true });
  });

  it("stays active once entered, even as the profile becomes complete", () => {
    useOnboardingStore.getState().enterOnboarding();
    expect(useOnboardingStore.getState().active).toBe(true);
    // Nothing about saving an answer touches `active` — that is the point.
    expect(isStyleProfileComplete(toStyleProfileRow(withHairLength))).toBe(true);
    expect(useOnboardingStore.getState().active).toBe(true);
  });

  it("clears only on the deliberate exit through Review", () => {
    useOnboardingStore.getState().enterOnboarding();
    useOnboardingStore.getState().exitOnboarding();
    expect(useOnboardingStore.getState().active).toBe(false);
  });

  it("is not persisted — a cold start re-derives it from the profile", () => {
    expect(PERSISTED_KEYS).not.toContain("active");
  });

  it("reset() wipes every trace, so a draft cannot follow a sign-out", () => {
    useOnboardingStore.getState().enterOnboarding();
    useOnboardingStore.getState().setCandidate({ season: "Autumn" } as never);
    useOnboardingStore.getState().setPending({ step: "body-type", payload: { body_type: "Pear" } });

    useOnboardingStore.getState().reset();

    const state = useOnboardingStore.getState();
    // A pending answer replayed into the next account would write one member's
    // body type onto a stranger's profile.
    expect(state.pending).toBeNull();
    expect(state.candidate).toBeNull();
    expect(state.active).toBe(false);
  });
});
