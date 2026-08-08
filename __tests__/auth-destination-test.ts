import { resolveDestination } from "@/lib/auth-destination";
import { isStyleProfileComplete } from "@/lib/style-profile/completion";
import type { Profile } from "@/types/models";

/**
 * This function runs on every cold start. A wrong answer either locks a member
 * out of an account she paid for or shows her a screen she has not earned, so
 * every combination is pinned — not just the happy path.
 */
describe("resolveDestination", () => {
  const base = { hasSession: true, suspended: false, profileComplete: true };

  it("sends a signed-out visitor to login", () => {
    expect(resolveDestination({ ...base, hasSession: false })).toBe("/login");
  });

  it("prefers login over every other state when there is no session", () => {
    // Suspension and completeness are unknowable without a session; they must
    // never leak a destination.
    expect(
      resolveDestination({ hasSession: false, suspended: true, profileComplete: false }),
    ).toBe("/login");
    expect(
      resolveDestination({ hasSession: false, suspended: true, profileComplete: true }),
    ).toBe("/login");
  });

  it("sends a suspended member to the block screen", () => {
    expect(resolveDestination({ ...base, suspended: true })).toBe("/suspended");
  });

  it("blocks a suspended member even when onboarding is incomplete", () => {
    expect(
      resolveDestination({ hasSession: true, suspended: true, profileComplete: false }),
    ).toBe("/suspended");
  });

  it("sends an incomplete profile to onboarding", () => {
    expect(resolveDestination({ ...base, profileComplete: false })).toBe(
      "/onboarding/welcome",
    );
  });

  it("sends a complete, active member into the app", () => {
    expect(resolveDestination(base)).toBe("/");
  });

  it("covers all eight input combinations", () => {
    const seen = new Set<string>();
    for (const hasSession of [true, false]) {
      for (const suspended of [true, false]) {
        for (const profileComplete of [true, false]) {
          seen.add(resolveDestination({ hasSession, suspended, profileComplete }));
        }
      }
    }
    expect(seen).toEqual(
      new Set(["/login", "/suspended", "/onboarding/welcome", "/"]),
    );
  });
});

describe("isStyleProfileComplete", () => {
  const complete: Profile = {
    id: "u1",
    full_name: "Ana",
    username: "ana",
    suspended: false,
    skin_undertone: "warm",
    color_season: "autumn",
    body_type: "hourglass",
    face_shape: "oval",
    hair_type: "wavy",
    color_profile: { season: "true-autumn" },
  };

  it("accepts a fully populated profile", () => {
    expect(isStyleProfileComplete(complete)).toBe(true);
  });

  it("rejects null and undefined", () => {
    expect(isStyleProfileComplete(null)).toBe(false);
    expect(isStyleProfileComplete(undefined)).toBe(false);
  });

  it.each([
    "skin_undertone",
    "color_season",
    "body_type",
    "face_shape",
    "hair_type",
  ] as const)("requires %s", (field) => {
    expect(isStyleProfileComplete({ ...complete, [field]: null })).toBe(false);
  });

  it("requires a non-empty color_profile", () => {
    expect(isStyleProfileComplete({ ...complete, color_profile: null })).toBe(false);
    expect(isStyleProfileComplete({ ...complete, color_profile: {} })).toBe(false);
  });

  it("accepts primarySwatches in place of season", () => {
    expect(
      isStyleProfileComplete({ ...complete, color_profile: { primarySwatches: ["#aaa"] } }),
    ).toBe(true);
  });

  it("rejects a color_profile with neither key", () => {
    expect(isStyleProfileComplete({ ...complete, color_profile: { note: "x" } })).toBe(false);
  });
});
