import {
  GETTING_STARTED_DISMISS_KEY,
  gettingStartedProgress,
  gettingStartedSteps,
  nextGettingStartedStep,
  readGettingStartedDismissed,
  writeGettingStartedDismissed,
  type DismissalStore,
  type GettingStartedInput,
} from "@/features/dashboard/getting-started";

const NEW_MEMBER: GettingStartedInput = {
  profilePercent: 0,
  hasPhotoConsent: false,
  hasComposedLook: false,
};

function store(initial: Record<string, string> = {}): DismissalStore & { values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    getItem: async (key) => values[key] ?? null,
    setItem: async (key, value) => {
      values[key] = value;
    },
  };
}

describe("getting started checklist", () => {
  it("tells a new member the three moves, in the order they happen", () => {
    const steps = gettingStartedSteps(NEW_MEMBER);
    expect(steps.map((step) => step.id)).toEqual(["profile", "photo", "look"]);
    expect(steps.every((step) => !step.done)).toBe(true);
  });

  it("carries the copy that makes each step actionable", () => {
    for (const step of gettingStartedSteps(NEW_MEMBER)) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.hint.length).toBeGreaterThan(0);
      expect(step.cta.length).toBeGreaterThan(0);
    }
  });

  it("never asks for the optional extras", () => {
    const copy = gettingStartedSteps(NEW_MEMBER)
      .map((step) => `${step.title} ${step.hint} ${step.cta}`)
      .join(" ")
      .toLowerCase();
    expect(copy).not.toMatch(/measurement|makeup|preference|dossier|optional:/);
  });

  it("counts the profile done at exactly 100, not at 99", () => {
    const at99 = gettingStartedSteps({ ...NEW_MEMBER, profilePercent: 99 });
    const at100 = gettingStartedSteps({ ...NEW_MEMBER, profilePercent: 100 });
    expect(at99[0].done).toBe(false);
    expect(at100[0].done).toBe(true);
  });

  it("keys the photo and look steps on their own signals", () => {
    const withPhoto = gettingStartedSteps({ ...NEW_MEMBER, hasPhotoConsent: true });
    const withLook = gettingStartedSteps({ ...NEW_MEMBER, hasComposedLook: true });
    expect(withPhoto[1].done).toBe(true);
    expect(withPhoto[2].done).toBe(false);
    expect(withLook[1].done).toBe(false);
    expect(withLook[2].done).toBe(true);
  });

  it("counts progress and reports all-done only when every step is done", () => {
    const none = gettingStartedProgress(gettingStartedSteps(NEW_MEMBER));
    expect(none).toEqual({ done: 0, total: 3, percent: 0, allDone: false });

    const partial = gettingStartedProgress(
      gettingStartedSteps({ ...NEW_MEMBER, profilePercent: 100, hasPhotoConsent: true }),
    );
    expect(partial).toEqual({ done: 2, total: 3, percent: 67, allDone: false });

    const all = gettingStartedProgress(
      gettingStartedSteps({ profilePercent: 100, hasPhotoConsent: true, hasComposedLook: true }),
    );
    expect(all).toEqual({ done: 3, total: 3, percent: 100, allDone: true });
  });

  it("reads an empty checklist as incomplete, never as finished", () => {
    const empty = gettingStartedProgress([]);
    expect(empty.allDone).toBe(false);
    expect(empty.percent).toBe(100);
  });

  it("points at the first unfinished step, and at nothing once finished", () => {
    expect(nextGettingStartedStep(gettingStartedSteps(NEW_MEMBER))?.id).toBe("profile");
    expect(
      nextGettingStartedStep(
        gettingStartedSteps({ ...NEW_MEMBER, profilePercent: 100, hasPhotoConsent: true }),
      )?.id,
    ).toBe("look");
    expect(
      nextGettingStartedStep(
        gettingStartedSteps({ profilePercent: 100, hasPhotoConsent: true, hasComposedLook: true }),
      ),
    ).toBeNull();
  });

  it("routes the profile step to the studio, and keeps the on-screen steps routeless", () => {
    const steps = gettingStartedSteps(NEW_MEMBER);
    expect(steps[0].route).toBe("/studio");
    // The photo and generator live on this screen, below the card.
    expect(steps[1].route).toBeUndefined();
    expect(steps[2].route).toBeUndefined();
  });

  it("a dismissal survives a reload", async () => {
    const fake = store();
    expect(await readGettingStartedDismissed(fake)).toBe(false);
    await writeGettingStartedDismissed(fake);
    expect(fake.values[GETTING_STARTED_DISMISS_KEY]).toBe("1");
    expect(await readGettingStartedDismissed(fake)).toBe(true);
  });

  it("a storage that throws never breaks Home", async () => {
    const broken: DismissalStore = {
      getItem: async () => {
        throw new Error("private mode");
      },
      setItem: async () => {
        throw new Error("private mode");
      },
    };
    await expect(readGettingStartedDismissed(broken)).resolves.toBe(false);
    await expect(writeGettingStartedDismissed(broken)).resolves.toBeUndefined();
  });
});
