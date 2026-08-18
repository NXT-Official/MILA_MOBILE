import type { DetailedColorProfile } from "@/constants/style-profile";
import { resolveSeasonFamily } from "@/features/studio/season";

/** Only the fields the resolver reads. */
const dossier = { season: "Autumn" } as DetailedColorProfile;

describe("resolveSeasonFamily", () => {
  it("prefers the persisted base column", () => {
    expect(resolveSeasonFamily("Winter", dossier)).toBe("Winter");
  });

  it("falls back to the dossier when the column is empty", () => {
    expect(resolveSeasonFamily(null, dossier)).toBe("Autumn");
    expect(resolveSeasonFamily(undefined, dossier)).toBe("Autumn");
    expect(resolveSeasonFamily("", dossier)).toBe("Autumn");
  });

  it("ignores an off-taxonomy base rather than trusting it", () => {
    expect(resolveSeasonFamily("Deep Winter", dossier)).toBe("Autumn");
    expect(resolveSeasonFamily("winter", dossier)).toBe("Autumn");
  });

  // The whole point of the helper: no season means no palette, never a
  // defaulted one — a Summer palette shown to an unread member is invented.
  it("returns null when neither source has a season", () => {
    expect(resolveSeasonFamily(null, null)).toBeNull();
    expect(resolveSeasonFamily("Deep Winter", null)).toBeNull();
  });
});
