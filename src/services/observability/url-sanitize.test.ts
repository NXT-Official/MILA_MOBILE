import { sanitizeScreenPath, sanitizeUrl } from "./url-sanitize";

describe("emails in URLs", () => {
  it("masks an email in a bare path", () => {
    expect(sanitizeUrl("/u/nicole@example.com")).toBe("/u/[email]");
  });

  it("masks a percent-encoded email in a path of a full URL", () => {
    const out = sanitizeUrl("https://mila.app/u/nicole%40example.com/closet");
    expect(out).toBe("https://mila.app/u/[email]/closet");
  });
});

describe("sanitizeScreenPath", () => {
  it("masks uuid and long id segments", () => {
    expect(sanitizeScreenPath("/look/550e8400-e29b-41d4-a716-446655440000")).toBe("/look/:token");
    expect(sanitizeScreenPath("/profile/abcdefghijklmnopqrstuvwxyz0123")).toBe("/profile/:token");
  });

  it("strips the query and fragment", () => {
    expect(sanitizeScreenPath("/auth/callback?code=abc#access_token=z")).toBe("/auth/callback");
  });

  it("masks emails and leaves ordinary routes alone", () => {
    expect(sanitizeScreenPath("/u/nicole@example.com")).toBe("/u/[email]");
    expect(sanitizeScreenPath("/settings/account")).toBe("/settings/account");
  });
});
