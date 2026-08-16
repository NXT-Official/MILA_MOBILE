import { generateDailyPalette } from "@/lib/color-analysis/paletteGenerator";
import { migrateLegacySeason } from "@/lib/color-analysis/schemaMigration";
import { SEASONS_DATA } from "@/lib/color-analysis/seasonsData";
import type { SeasonId } from "@/lib/color-analysis/types";
import { isDailyPalette } from "@/lib/saved-palette";
import { toSeasonId } from "@/lib/season-id";

/**
 * The 16-season engine. Copied from the web (Appendix A), and determinism is
 * the product: two members with identical portraits must get identical seasons
 * on both clients. These tests exist so a re-copy that lands wrong fails here
 * rather than in someone's dossier.
 */

const ALL_SEASON_IDS = Object.keys(SEASONS_DATA) as SeasonId[];

describe("SEASONS_DATA", () => {
  it("has exactly the 16 seasons", () => {
    expect(ALL_SEASON_IDS).toHaveLength(16);
  });

  it("keys every entry by its own id", () => {
    // A mismatch here means a lookup by id returns another season's profile —
    // the single worst failure this module can have.
    for (const [key, profile] of Object.entries(SEASONS_DATA)) {
      expect(profile.id).toBe(key);
    }
  });

  it("gives every season four of each family", () => {
    const byFamily = ALL_SEASON_IDS.reduce<Record<string, number>>((acc, id) => {
      const family = SEASONS_DATA[id].family;
      acc[family] = (acc[family] ?? 0) + 1;
      return acc;
    }, {});
    expect(byFamily).toEqual({ Spring: 4, Summer: 4, Autumn: 4, Winter: 4 });
  });

  it("points every sister season at a real season", () => {
    for (const id of ALL_SEASON_IDS) {
      expect(SEASONS_DATA).toHaveProperty(SEASONS_DATA[id].sisterSeasonId);
    }
  });

  it("never lists a season as its own sister", () => {
    for (const id of ALL_SEASON_IDS) {
      expect(SEASONS_DATA[id].sisterSeasonId).not.toBe(id);
    }
  });

  it("gives every season a name and both colour lists", () => {
    for (const id of ALL_SEASON_IDS) {
      const profile = SEASONS_DATA[id];
      expect(profile.name.trim().length).toBeGreaterThan(0);
      expect(profile.bestColorsDescription.length).toBeGreaterThan(0);
      expect(profile.avoidColorsDescription.length).toBeGreaterThan(0);
    }
  });

  it("gives every season a complete dimension set", () => {
    for (const id of ALL_SEASON_IDS) {
      const { value, contrast, undertone, chroma } = SEASONS_DATA[id].dimensions;
      expect(typeof value).toBe("string");
      expect(typeof contrast).toBe("string");
      expect(typeof undertone).toBe("string");
      expect(typeof chroma).toBe("string");
    }
  });
});

describe("toSeasonId", () => {
  it("converts every stored display name to its id", () => {
    // `profiles.color_profile.subSeason` stores "True Autumn"; the engine keys
    // off `true_autumn`. Every one of the 16 must round-trip.
    for (const id of ALL_SEASON_IDS) {
      expect(toSeasonId(SEASONS_DATA[id].name)).toBe(id);
    }
  });

  it("is case and whitespace insensitive", () => {
    expect(toSeasonId("  tRuE   autumn ")).toBe("true_autumn");
  });

  it("maps a bare base season the way the web does", () => {
    // `buildDashboardProfile` falls back to the base season when the dossier
    // carries no `subSeason`, so a member who picked her season by hand arrives
    // as "Autumn". Rejecting that hid the daily palette on mobile for members
    // who could see it on the web with the same account.
    expect(toSeasonId("Spring")).toBe("true_spring");
    expect(toSeasonId("Summer")).toBe("true_summer");
    expect(toSeasonId("Autumn")).toBe("true_autumn");
    expect(toSeasonId("Winter")).toBe("true_winter");
    expect(toSeasonId("  autumn ")).toBe("true_autumn");
  });

  it("rejects an unrecognised season rather than inventing one", () => {
    // An unrecognised season silently becoming a valid-looking id is how a
    // member gets someone else's palette.
    expect(toSeasonId("Deep Spring")).toBeNull();
    expect(toSeasonId("not a season")).toBeNull();
    expect(toSeasonId("")).toBeNull();
    expect(toSeasonId(null)).toBeNull();
    expect(toSeasonId(undefined)).toBeNull();
  });
});

describe("migrateLegacySeason", () => {
  it("maps each legacy family to its true season", () => {
    expect(migrateLegacySeason("spring")).toBe("true_spring");
    expect(migrateLegacySeason("summer")).toBe("true_summer");
    expect(migrateLegacySeason("autumn")).toBe("true_autumn");
    expect(migrateLegacySeason("winter")).toBe("true_winter");
  });

  it("is case and whitespace insensitive", () => {
    expect(migrateLegacySeason("  Winter ")).toBe("true_winter");
  });

  it("passes an already-migrated id through unchanged", () => {
    expect(migrateLegacySeason("soft_summer")).toBe("soft_summer");
  });

  /**
   * Documents current behaviour rather than endorsing it. The `default` branch
   * casts an unrecognised string to `SeasonId` with `as`, so a junk value
   * escapes the type system and reaches the engine. `toSeasonId` above is the
   * one that validates; this one does not. Reported, not silently patched —
   * the file is an Appendix A copy and the fix belongs on the web.
   */
  it("does NOT validate an unknown season — known gap", () => {
    expect(migrateLegacySeason("mauve")).toBe("mauve");
    expect(SEASONS_DATA).not.toHaveProperty("mauve");
  });
});

describe("generateDailyPalette", () => {
  it("returns a well-formed palette for every season", () => {
    for (const id of ALL_SEASON_IDS) {
      expect(isDailyPalette(generateDailyPalette(id))).toBe(true);
    }
  });

  /** Ported from the web's own `paletteGenerator.test.ts`. */
  it("never repeats the same mix twice in a row", () => {
    let previous = generateDailyPalette("cool_summer");
    for (let i = 0; i < 100; i += 1) {
      const next = generateDailyPalette("cool_summer");
      expect(next.baseHex).not.toBe(previous.baseHex);
      previous = next;
    }
  });

  it("pairs every hex with a name", () => {
    const palette = generateDailyPalette("true_winter");
    for (const name of [palette.baseColor, palette.statementColor, palette.accentColor]) {
      expect(name.trim().length).toBeGreaterThan(0);
    }
    for (const hex of [palette.baseHex, palette.statementHex, palette.accentHex]) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  /**
   * Documents a shared limitation, not drift: `generateDailyPalette` takes a
   * season and immediately discards it (`void userSeasonId`), picking from five
   * curated mixes at random. The web does exactly the same. Pinned here so that
   * if either side ever makes it season-aware, the divergence is visible.
   */
  it("does NOT vary by season today — shared limitation with the web", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(generateDailyPalette("light_spring").baseHex);
    }
    const winterSeen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      winterSeen.add(generateDailyPalette("deep_winter").baseHex);
    }
    expect(seen).toEqual(winterSeen);
  });
});
