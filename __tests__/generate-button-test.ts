import {
  resolveBlockedReason,
  type BlockedReason,
} from "@/features/dashboard/components/GenerateButton";

const READY = {
  online: true,
  profileComplete: true,
  hasWeather: true,
  rateLimitedFor: 0,
  renderingVisual: false,
};

function reason(overrides: Partial<typeof READY>): BlockedReason | null {
  return resolveBlockedReason({ ...READY, ...overrides });
}

describe("resolveBlockedReason", () => {
  it("unblocks when everything is in place", () => {
    expect(reason({})).toBeNull();
  });

  it("blocks offline first — nothing else matters without a connection", () => {
    expect(reason({ online: false, renderingVisual: true })).toBe("offline");
  });

  it("lets a rate limit outrank a render in flight: it is the one with a clock", () => {
    expect(reason({ rateLimitedFor: 42, renderingVisual: true })).toBe("rate-limited");
  });

  /**
   * The window this reason exists for: the look is composed, the visual is not
   * on screen yet. A second tap there would compose — and pay for — another
   * look on top of the picture already on its way.
   */
  it("blocks while the look's visual is still rendering", () => {
    expect(reason({ renderingVisual: true })).toBe("rendering");
  });

  it("still blocks a profile that is not finished", () => {
    expect(reason({ profileComplete: false })).toBe("profile-incomplete");
  });

  it("still blocks without weather", () => {
    expect(reason({ hasWeather: false })).toBe("no-weather");
  });
});
