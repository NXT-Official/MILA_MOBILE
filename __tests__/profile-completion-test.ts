import { BODIES, FACE_SHAPES, HAIR_TYPES, SEASONS, UNDERTONES } from "@/constants/style-profile";
import { normalizeBeautyPreferences } from "@/lib/beauty-preferences";
import { deriveColorMetrics } from "@/lib/profile-color";
import {
  dossierCompletion,
  isNonEmptyColorProfile,
  isStyleProfileComplete,
  toStyleProfileRow,
  type StyleProfileRow,
} from "@/lib/style-profile/completion";
import type { DashboardProfile } from "@/types/models";

/**
 * `isStyleProfileComplete()` is the onboarding exit gate and the launch gate.
 * These tests pin the COPIED implementation against the web's behaviour — most
 * importantly that it validates against the taxonomy lists rather than merely
 * checking for a truthy value. A profile saying `body_type: "curvy"` is not
 * complete, and a client that thinks otherwise strands a member in a Home
 * screen the server cannot personalise.
 */

const complete: StyleProfileRow = {
  skin_undertone: "Warm",
  color_season: "Autumn",
  body_type: "Hourglass",
  face_shape: "Oval",
  hair_type: "Wavy",
  color_profile: { season: "Autumn", subSeason: "Autumn True" },
};

describe("isStyleProfileComplete", () => {
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
    expect(isStyleProfileComplete({ ...complete, color_profile: [] })).toBe(false);
    expect(isStyleProfileComplete({ ...complete, color_profile: "Autumn" })).toBe(false);
  });

  it("accepts primarySwatches in place of season", () => {
    expect(
      isStyleProfileComplete({ ...complete, color_profile: { primarySwatches: [] } }),
    ).toBe(true);
  });

  it("rejects a color_profile carrying neither key", () => {
    expect(isStyleProfileComplete({ ...complete, color_profile: { note: "x" } })).toBe(false);
  });

  // The regression that matters: a value must be IN the taxonomy, not merely
  // truthy. Casing counts — the AI prompts and season matrices are keyed on it.
  it.each([
    ["skin_undertone", "warm"],
    ["color_season", "autumn"],
    ["body_type", "hourglass"],
    ["face_shape", "oval"],
    ["hair_type", "wavy"],
  ] as const)("rejects %s outside the taxonomy (%s)", (field, value) => {
    expect(isStyleProfileComplete({ ...complete, [field]: value })).toBe(false);
  });

  it("accepts every value the taxonomy allows", () => {
    for (const skin_undertone of UNDERTONES) {
      expect(isStyleProfileComplete({ ...complete, skin_undertone })).toBe(true);
    }
    for (const color_season of SEASONS) {
      expect(isStyleProfileComplete({ ...complete, color_season })).toBe(true);
    }
    for (const body_type of BODIES) {
      expect(isStyleProfileComplete({ ...complete, body_type })).toBe(true);
    }
    for (const face_shape of FACE_SHAPES) {
      expect(isStyleProfileComplete({ ...complete, face_shape })).toBe(true);
    }
    for (const hair_type of HAIR_TYPES) {
      expect(isStyleProfileComplete({ ...complete, hair_type })).toBe(true);
    }
  });

  it("takes the base season, never the sub-season, from a dashboard profile", () => {
    // `color_season` on a DashboardProfile is the display sub-season
    // ("Autumn True"), which is not in SEASONS. Reading it instead of
    // `color_season_base` would make every complete member look incomplete.
    const row = toStyleProfileRow({
      skin_undertone: "Warm",
      color_season_base: "Autumn",
      body_type: "Hourglass",
      face_shape: "Oval",
      hair_type: "Wavy",
      color_profile: { season: "Autumn" },
    });
    expect(row?.color_season).toBe("Autumn");
    expect(isStyleProfileComplete(row)).toBe(true);
    expect(toStyleProfileRow(null)).toBeNull();
  });
});

describe("isNonEmptyColorProfile", () => {
  it.each([null, undefined, 0, "", "season", [], [{ season: "Autumn" }], {}])(
    "rejects %p",
    (value) => {
      expect(isNonEmptyColorProfile(value)).toBe(false);
    },
  );

  it("accepts an object carrying season or primarySwatches", () => {
    expect(isNonEmptyColorProfile({ season: "Autumn" })).toBe(true);
    expect(isNonEmptyColorProfile({ primarySwatches: [] })).toBe(true);
  });
});

describe("deriveColorMetrics", () => {
  it("prefers the dossier's own values over the flat columns", () => {
    const metrics = deriveColorMetrics({
      color_profile: { season: "Winter", undertone: "Cool" },
      color_season: "Autumn",
      skin_undertone: "Warm",
    });
    expect(metrics.season).toBe("Winter");
    expect(metrics.undertone).toBe("Cool");
  });

  it("falls back to the flat columns for a legacy row", () => {
    const metrics = deriveColorMetrics({ color_season: "Autumn", skin_undertone: "Warm" });
    expect(metrics.season).toBe("Autumn");
    expect(metrics.undertone).toBe("Warm");
  });

  it("returns nulls rather than throwing on an absent profile", () => {
    expect(deriveColorMetrics(null)).toEqual({
      season: null,
      undertone: null,
      hue: null,
      value: null,
      chroma: null,
      selectedAesthetic: null,
    });
  });
});

describe("normalizeBeautyPreferences", () => {
  it("passes an array through, trimmed and de-duplicated", () => {
    expect(normalizeBeautyPreferences([" Bold Lip ", "Bold Lip", "", "Minimalist"])).toEqual([
      "Bold Lip",
      "Minimalist",
    ]);
  });

  it("reads the legacy boolean-map shape", () => {
    expect(normalizeBeautyPreferences({ boldLip: true, dewy_base: true, softSmoke: false })).toEqual(
      ["Bold Lip", "Dewy Base"],
    );
  });

  it("unwraps the legacy { selected: [...] } shape", () => {
    expect(normalizeBeautyPreferences({ selected: ["Glass Skin"] })).toEqual(["Glass Skin"]);
  });

  it("treats null, undefined, and a scalar as no preference", () => {
    expect(normalizeBeautyPreferences(null)).toEqual([]);
    expect(normalizeBeautyPreferences(undefined)).toEqual([]);
    expect(normalizeBeautyPreferences("Bold Lip")).toEqual([]);
  });
});

/**
 * `dossierCompletion()` measures the optional depth, not the gate — a member
 * only reaches the dashboard with the required six already in hand. These pin
 * the COPIED implementation against the web's, including that it validates
 * against the taxonomy lists rather than merely checking for truthiness.
 */

const FULL: DashboardProfile = {
  body_type: "Hourglass",
  color_season: "Spring Light",
  color_season_base: "Spring",
  skin_undertone: "Warm",
  full_name: "Test Member",
  face_shape: "Oval",
  hair_type: "Wavy",
  beauty_preferences: ["Minimalist"],
  color_profile: { season: "Spring" },
  default_location: "paris",
  style_goals: [],
  suspended: false,
};

describe("dossierCompletion", () => {
  it("reads 100% with nothing missing when every signal is filled", () => {
    expect(dossierCompletion(FULL)).toEqual({
      filled: 8,
      total: 8,
      percent: 100,
      missing: [],
    });
  });

  it("leaves only the optional signals once onboarding's gate is passed", () => {
    const result = dossierCompletion({ ...FULL, beauty_preferences: [], default_location: null });
    expect(result.missing).toEqual(["Beauty preferences", "Home city"]);
    expect(result.percent).toBe(75);
    // The required six are still complete, so the app still lets her generate.
    expect(isStyleProfileComplete(toStyleProfileRow(FULL))).toBe(true);
  });

  it("names every signal for an empty profile", () => {
    const result = dossierCompletion(null);
    expect(result.percent).toBe(0);
    expect(result.missing).toHaveLength(8);
  });

  it("does not count an off-taxonomy value as filled", () => {
    const result = dossierCompletion({ ...FULL, body_type: "Trapezoid", face_shape: "" });
    expect(result.missing).toEqual(["Body silhouette", "Face shape"]);
    expect(result.percent).toBe(75);
  });

  it("does not accept a whitespace-only home city", () => {
    expect(dossierCompletion({ ...FULL, default_location: "   " }).missing).toEqual(["Home city"]);
  });
});
