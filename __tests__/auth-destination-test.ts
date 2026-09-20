import { resolveDestination } from "@/lib/auth-destination";

// `isStyleProfileComplete()` — the third input to this decision — is covered in
// __tests__/profile-completion-test.ts against the copied implementation.

/**
 * This function runs on every cold start. A wrong answer either locks a member
 * out of an account she paid for or shows her a screen she has not earned, so
 * every combination is pinned — not just the happy path.
 */
describe("resolveDestination", () => {
  const base = { hasSession: true, suspended: false, profileComplete: true, recovery: false };

  it("sends a signed-out visitor to login", () => {
    expect(resolveDestination({ ...base, hasSession: false })).toBe("/login");
  });

  it("prefers login over every other state when there is no session", () => {
    // Suspension and completeness are unknowable without a session; they must
    // never leak a destination.
    expect(
      resolveDestination({ hasSession: false, suspended: true, profileComplete: false, recovery: false }),
    ).toBe("/login");
    expect(
      resolveDestination({ hasSession: false, suspended: true, profileComplete: true, recovery: false }),
    ).toBe("/login");
  });

  it("sends a recovery deep link to the reset-password screen", () => {
    expect(resolveDestination({ ...base, recovery: true })).toBe("/reset-password");
  });

  it("prefers recovery over every other state, even with no session yet", () => {
    // The reset-password screen itself calls setSession — recovery must hold
    // before that session exists, or the gate never lets her reach it.
    expect(
      resolveDestination({ hasSession: false, suspended: true, profileComplete: false, recovery: true }),
    ).toBe("/reset-password");
    expect(
      resolveDestination({ hasSession: true, suspended: true, profileComplete: false, recovery: true }),
    ).toBe("/reset-password");
  });

  it("sends a suspended member to the block screen", () => {
    expect(resolveDestination({ ...base, suspended: true })).toBe("/suspended");
  });

  it("blocks a suspended member even when onboarding is incomplete", () => {
    expect(
      resolveDestination({
        hasSession: true,
        suspended: true,
        profileComplete: false,
        recovery: false,
      }),
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

  it("covers all sixteen input combinations", () => {
    const seen = new Set<string>();
    for (const hasSession of [true, false]) {
      for (const suspended of [true, false]) {
        for (const profileComplete of [true, false]) {
          for (const recovery of [true, false]) {
            seen.add(resolveDestination({ hasSession, suspended, profileComplete, recovery }));
          }
        }
      }
    }
    expect(seen).toEqual(
      new Set(["/login", "/reset-password", "/suspended", "/onboarding/welcome", "/"]),
    );
  });
});
