/**
 * Parity with the web: the Wave D shared modules are copied verbatim, and these
 * are the web's own golden vectors, ported unchanged. If a vector here and its
 * web twin ever disagree, the copy has drifted.
 */
import { HAIR_COLORS, HAIR_COLOR_OPTIONS, isHairColor } from "@/constants/style-profile/hair-colors";
import * as styleProfile from "@/constants/style-profile";
import { isWaveDMissing, WAVE_D_MISSING_CODES } from "@/lib/wave-d-availability";
import {
  ANALYSIS_DISMISSED_LIMIT,
  ANALYSIS_OFFER_WINDOW_MS,
  ANALYSIS_POLL_MS,
  ANALYSIS_REAP_GRACE_MS,
  PERSIST_FAILED_DELIVERED,
  analysisJobOffer,
  rememberDismissed,
  type AnalysisJobLike,
} from "@/lib/analysis-job-offer";
import { chroma, hexToLab, isHex, lightness } from "@/lib/color-analysis/colour-math";
import {
  MAX_MEMBER_SWATCHES,
  MAX_SWATCH_NAME_LENGTH,
  memberSwatches,
} from "@/lib/color-analysis/member-swatches";

// --- constants/style-profile/hair-colors ---
{
// Golden vector: the stored values, in order. Mobile copies this list verbatim.
const GOLDEN = [
  "Black",
  "Dark brown",
  "Medium brown",
  "Light brown",
  "Auburn",
  "Red",
  "Golden blonde",
  "Ash blonde",
  "Platinum blonde",
  "Grey or silver",
  "White",
  "Vivid dyed shade",
];

const DASHES = /[-‐-―−]/;

describe("HAIR_COLORS", () => {
  test("is the shared list of stored values, in order", () => {
    expect([...HAIR_COLORS]).toEqual(GOLDEN);
  });

  test("every value is 1 to 40 characters with no dashes", () => {
    for (const value of HAIR_COLORS) {
      expect(value.length).toBeGreaterThanOrEqual(1);
      expect(value.length).toBeLessThanOrEqual(40);
      expect(value).not.toMatch(DASHES);
      expect(value).toBe(value.trim());
    }
  });

  test("never uses the word colour or color, so both apps store the same values", () => {
    for (const value of HAIR_COLORS) expect(value.toLowerCase()).not.toMatch(/colou?r/);
  });

  test("values are unique", () => {
    expect(new Set(HAIR_COLORS).size).toBe(HAIR_COLORS.length);
  });
});

describe("isHairColor", () => {
  test("accepts exactly the stored values", () => {
    for (const value of HAIR_COLORS) expect(isHairColor(value)).toBe(true);
  });

  test("refuses anything else, including other casing and padding", () => {
    for (const value of ["black", " Black", "Brown", "", "Blue", null, undefined, 3, {}]) {
      expect(isHairColor(value)).toBe(false);
    }
  });
});

describe("HAIR_COLOR_OPTIONS", () => {
  test("one option per value, titled by its value", () => {
    expect(HAIR_COLOR_OPTIONS.map((o) => o.value)).toEqual(GOLDEN);
    for (const option of HAIR_COLOR_OPTIONS) expect(option.title).toBe(option.value);
  });

  test("each has a one-line description with no dashes", () => {
    for (const option of HAIR_COLOR_OPTIONS) {
      expect(option.description.trim().length).toBeGreaterThan(0);
      expect(option.description).not.toContain("\n");
      expect(option.description).not.toMatch(DASHES);
    }
  });

  test("descriptions never say color or colour, so mobile can copy them verbatim", () => {
    for (const option of HAIR_COLOR_OPTIONS) {
      expect(option.description.toLowerCase()).not.toMatch(/colou?r/);
    }
  });

  test("is exported from the style-profile constants", () => {
    expect(styleProfile.HAIR_COLORS).toBe(HAIR_COLORS);
    expect(styleProfile.HAIR_COLOR_OPTIONS).toBe(HAIR_COLOR_OPTIONS);
    expect(styleProfile.isHairColor).toBe(isHairColor);
  });
});
}

// --- lib/wave-d-availability ---
{
describe("WAVE_D_MISSING_CODES", () => {
  test("names every way PostgREST and Postgres say a Wave D object is not there yet", () => {
    // Golden vector, copied verbatim by mobile.
    expect([...WAVE_D_MISSING_CODES].sort()).toEqual(
      ["42703", "42883", "42P01", "PGRST202", "PGRST204", "PGRST205"].sort(),
    );
  });
});

describe("isWaveDMissing", () => {
  test("a missing column, table or function means the migration is not applied", () => {
    for (const code of ["PGRST202", "PGRST204", "PGRST205", "42P01", "42703", "42883"]) {
      expect(isWaveDMissing({ code, message: "" })).toBe(true);
    }
  });

  test("anything else is a real error", () => {
    for (const code of ["42501", "23505", "23514", "PGRST116", "PGRST301", "", "P0001"]) {
      expect(isWaveDMissing({ code, message: "" })).toBe(false);
    }
  });

  test("never throws on odd input", () => {
    for (const value of [null, undefined, "42703", 42703, {}, [], new Error("boom")]) {
      expect(isWaveDMissing(value)).toBe(false);
    }
    expect(isWaveDMissing({ code: 42703 })).toBe(false);
  });

  test("reads the code off an Error too", () => {
    const error = Object.assign(new Error("column profiles.hair_color does not exist"), {
      code: "42703",
    });
    expect(isWaveDMissing(error)).toBe(true);
  });
});
}

// --- lib/analysis-job-offer ---
{
// Golden vectors: fixed clock, PostgREST-style timestamps (microseconds,
// +00:00). Mobile copies these verbatim.
const NOW = Date.parse("2026-10-07T12:00:00.000Z");

function job(overrides: Partial<AnalysisJobLike> = {}): AnalysisJobLike {
  return {
    id: "job-1",
    status: "succeeded",
    result: { silhouette: "Hourglass" },
    errorCode: null,
    deadlineAt: "2026-10-07T11:05:00.000000+00:00",
    completedAt: "2026-10-07T11:01:30.123456+00:00",
    ...overrides,
  };
}

describe("analysis job constants", () => {
  test("match the shared contract (section 3.5)", () => {
    expect(ANALYSIS_POLL_MS).toBe(3_000);
    expect(ANALYSIS_REAP_GRACE_MS).toBe(30_000);
    expect(ANALYSIS_OFFER_WINDOW_MS).toBe(12 * 60 * 60 * 1000);
    expect(ANALYSIS_DISMISSED_LIMIT).toBe(20);
    expect(PERSIST_FAILED_DELIVERED).toBe("persist_failed_delivered");
  });
});

describe("analysisJobOffer", () => {
  test("running, stale, ready within 12 hours, failed, never a persist_failed_delivered row, never her used or applied job, never a dismissed job", () => {
    // running: up to deadline + 30 s, inclusive.
    const running = job({
      status: "running",
      completedAt: null,
      deadlineAt: "2026-10-07T11:59:30.000000+00:00",
    });
    expect(analysisJobOffer(running, { now: NOW })).toBe("running");
    expect(
      analysisJobOffer(job({ ...running, deadlineAt: "2026-10-07T12:00:30.000000+00:00" }), {
        now: NOW,
      }),
    ).toBe("running");

    // stale: running one millisecond past deadline + 30 s.
    expect(
      analysisJobOffer(job({ ...running, deadlineAt: "2026-10-07T11:59:29.999000+00:00" }), {
        now: NOW,
      }),
    ).toBe("stale");

    // ready within 12 hours; exactly 12 hours is still ready, a moment later is not
    // (on another local day: the calendar is pinned so this holds in every time zone).
    const otherDay = () => false;
    expect(analysisJobOffer(job(), { now: NOW })).toBe("ready");
    expect(
      analysisJobOffer(job({ completedAt: "2026-10-07T00:00:00+00:00" }), {
        now: NOW,
        sameLocalDay: otherDay,
      }),
    ).toBe("ready");
    expect(
      analysisJobOffer(job({ completedAt: "2026-10-06T23:59:59.999+00:00" }), {
        now: NOW,
        sameLocalDay: otherDay,
      }),
    ).toBeNull();

    // failed within 12 hours.
    const failed = job({ status: "failed", result: null, errorCode: "provider_error" });
    expect(analysisJobOffer(failed, { now: NOW })).toBe("failed");
    expect(
      analysisJobOffer(job({ ...failed, completedAt: "2026-10-06T11:00:00+00:00" }), { now: NOW }),
    ).toBeNull();

    // A delivered-and-charged row is never a failure.
    expect(
      analysisJobOffer(job({ ...failed, errorCode: PERSIST_FAILED_DELIVERED }), { now: NOW }),
    ).toBeNull();

    // Never her used job (color_read) or a job she already applied (check_in).
    expect(analysisJobOffer(job(), { now: NOW, usedJobId: "job-1" })).toBeNull();
    expect(analysisJobOffer(job(), { now: NOW, usedJobId: "job-0" })).toBe("ready");
    expect(
      analysisJobOffer(job(), { now: NOW, appliedAt: "2026-10-07T11:01:30.123456+00:00" }),
    ).toBeNull();
    expect(
      analysisJobOffer(job(), { now: NOW, appliedAt: "2026-10-07T11:30:00.000000+00:00" }),
    ).toBeNull();
    expect(analysisJobOffer(job(), { now: NOW, appliedAt: "2026-10-07T11:01:30.122+00:00" })).toBe(
      "ready",
    );
    expect(analysisJobOffer(job(), { now: NOW, appliedAt: null })).toBe("ready");

    // Never a dismissed job, ready or failed.
    expect(analysisJobOffer(job(), { now: NOW, dismissedIds: ["job-1"] })).toBeNull();
    expect(analysisJobOffer(failed, { now: NOW, dismissedIds: ["job-1"] })).toBeNull();
    expect(analysisJobOffer(job(), { now: NOW, dismissedIds: ["job-2"] })).toBe("ready");
  });

  test("offers a job finished on her local day, or within 12 hours (the shared recovery rule)", () => {
    // Local wall-clock times, so these hold in every time zone.
    const at = (day: number, h: number, m = 0, s = 0, ms = 0) =>
      new Date(2026, 9, day, h, m, s, ms).getTime();
    const iso = (time: number) => new Date(time).toISOString();
    const failed = { status: "failed", result: null, errorCode: "provider_error" };

    // Earlier today always counts, however long ago: 00:30, opened at 23:00.
    expect(analysisJobOffer(job({ completedAt: iso(at(7, 0, 30)) }), { now: at(7, 23) })).toBe(
      "ready",
    );
    expect(
      analysisJobOffer(job({ ...failed, completedAt: iso(at(7, 0, 30)) }), { now: at(7, 23) }),
    ).toBe("failed");

    // Across midnight within 12 hours: 23:58 still counts at 00:02.
    expect(analysisJobOffer(job({ completedAt: iso(at(6, 23, 58)) }), { now: at(7, 0, 2) })).toBe(
      "ready",
    );
    expect(
      analysisJobOffer(job({ ...failed, completedAt: iso(at(6, 23, 58)) }), { now: at(7, 0, 2) }),
    ).toBe("failed");

    // Yesterday 23:30: exactly 12 hours counts, one millisecond more does not.
    expect(analysisJobOffer(job({ completedAt: iso(at(6, 23, 30)) }), { now: at(7, 11, 30) })).toBe(
      "ready",
    );
    expect(
      analysisJobOffer(job({ completedAt: iso(at(6, 23, 30)) }), { now: at(7, 11, 30, 0, 1) }),
    ).toBeNull();

    // No completed_at: created_at is when it finished.
    expect(
      analysisJobOffer(job({ completedAt: null, createdAt: iso(at(7, 8)) }), { now: at(7, 9) }),
    ).toBe("ready");

    // The calendar can be injected.
    expect(
      analysisJobOffer(job({ completedAt: iso(at(5, 8)) }), {
        now: at(7, 9),
        sameLocalDay: () => true,
      }),
    ).toBe("ready");
  });

  test("a colour read respects appliedAt like the others: a profile saved after it hides it", () => {
    // usedJobId is another read, but she saved her colours (a quiz) after this one finished.
    expect(
      analysisJobOffer(job(), {
        now: NOW,
        usedJobId: "job-0",
        appliedAt: "2026-10-07T11:30:00.000000+00:00",
      }),
    ).toBeNull();
    expect(
      analysisJobOffer(job(), {
        now: NOW,
        usedJobId: "job-0",
        appliedAt: "2026-10-07T10:00:00.000000+00:00",
      }),
    ).toBe("ready");
  });

  test("a result check that throws, or answers anything but true, is not offerable", () => {
    const throwing = () => {
      throw new Error("unexpected shape");
    };
    expect(analysisJobOffer(job(), { now: NOW, resultParses: throwing })).toBeNull();
    const notBoolean = (() => ({ success: false })) as unknown as (result: unknown) => boolean;
    expect(analysisJobOffer(job(), { now: NOW, resultParses: notBoolean })).toBeNull();
  });

  test("a result that does not parse is never offered as ready", () => {
    expect(analysisJobOffer(job({ result: null }), { now: NOW })).toBeNull();
    expect(analysisJobOffer(job({ result: "text" }), { now: NOW })).toBeNull();
    expect(analysisJobOffer(job({ result: [1] }), { now: NOW })).toBeNull();
    const silhouetteOnly = (result: unknown) =>
      typeof result === "object" && result !== null && "silhouette" in result;
    expect(analysisJobOffer(job(), { now: NOW, resultParses: silhouetteOnly })).toBe("ready");
    expect(
      analysisJobOffer(job({ result: { other: 1 } }), { now: NOW, resultParses: silhouetteOnly }),
    ).toBeNull();
  });

  test("no job, an unknown status or an unreadable time offers nothing", () => {
    expect(analysisJobOffer(null, { now: NOW })).toBeNull();
    expect(analysisJobOffer(undefined, { now: NOW })).toBeNull();
    expect(analysisJobOffer(job({ status: "queued" }), { now: NOW })).toBeNull();
    expect(analysisJobOffer(job({ completedAt: null }), { now: NOW })).toBeNull();
    expect(analysisJobOffer(job({ completedAt: "not a time" }), { now: NOW })).toBeNull();
    expect(
      analysisJobOffer(job({ status: "running", completedAt: null, deadlineAt: "soon" }), {
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe("rememberDismissed", () => {
  test("keeps the last 20 ids, newest last, without duplicates", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `job-${i}`);
    const next = rememberDismissed(ids, "job-20");
    expect(next).toHaveLength(20);
    expect(next[0]).toBe("job-1");
    expect(next[19]).toBe("job-20");
    expect(rememberDismissed(["a", "b"], "a")).toEqual(["b", "a"]);
    expect(rememberDismissed([], "a")).toEqual(["a"]);
  });

  test("never mutates the list it was given", () => {
    const ids = ["a"];
    rememberDismissed(ids, "b");
    expect(ids).toEqual(["a"]);
  });
});
}

// --- lib/color-analysis/colour-math ---
{
// Golden vectors: sRGB (D65) to CIELAB, rounded to 4 decimals. Mobile copies
// these verbatim, so both apps agree on "deepest" and "most vivid".
const GOLDEN: Array<[hex: string, l: number, a: number, b: number, c: number]> = [
  ["#000000", 0, 0, 0, 0],
  ["#FFFFFF", 100, 0, 0, 0],
  ["#808080", 53.585, 0, 0, 0],
  ["#FF0000", 53.2408, 80.0925, 67.2032, 104.5518],
  ["#00FF00", 87.7347, -86.1827, 83.1793, 119.7759],
  ["#0000FF", 32.297, 79.1875, -107.8602, 133.8076],
  ["#C19A6B", 66.1455, 8.367, 30.1537, 31.293],
  ["#36454F", 28.3927, -3.2506, -7.9574, 8.5957],
  ["#800020", 25.8476, 48.8945, 21.2972, 53.3315],
];

describe("colour math", () => {
  test("lightness of #000000 is 0 and #FFFFFF is 100", () => {
    expect(lightness("#000000")).toBe(0);
    expect(lightness("#FFFFFF")).toBe(100);
  });

  test("hexToLab, lightness and chroma match the golden vectors", () => {
    for (const [hex, l, a, b, c] of GOLDEN) {
      expect(hexToLab(hex)).toEqual({ l, a, b });
      expect(lightness(hex)).toBe(l);
      expect(chroma(hex)).toBe(c);
    }
  });

  test("lower case hex reads the same as upper case", () => {
    expect(hexToLab("#c19a6b")).toEqual(hexToLab("#C19A6B"));
  });

  test("never returns negative zero", () => {
    const white = hexToLab("#FFFFFF");
    expect(Object.is(white?.a, -0)).toBe(false);
    expect(Object.is(white?.b, -0)).toBe(false);
  });

  test("an invalid hex reads as null, never NaN", () => {
    for (const bad of ["", "#FFF", "FFFFFF", "#GGGGGG", "#FFFFFFF", "red"]) {
      expect(hexToLab(bad)).toBeNull();
      expect(lightness(bad)).toBeNull();
      expect(chroma(bad)).toBeNull();
    }
  });
});

describe("isHex", () => {
  test("accepts #RRGGBB in either case", () => {
    expect(isHex("#A1b2C3")).toBe(true);
    expect(isHex("#000000")).toBe(true);
  });

  test("refuses everything else", () => {
    for (const value of [
      "#FFF",
      "A1B2C3",
      "#A1B2C",
      "#A1B2C3 ",
      "#A1B2CZ",
      null,
      undefined,
      0xffffff,
    ]) {
      expect(isHex(value)).toBe(false);
    }
  });
});
}

// --- lib/color-analysis/member-swatches ---
{
// Golden vectors, copied verbatim by mobile.
const V1_PROFILE = {
  season: "Autumn",
  primarySwatches: [
    { hex: "#8B4513", name: "Saddle Brown" },
    { hex: "#c19a6b", name: "Camel" },
    { hex: "#556B2F", name: "Olive" },
    { hex: "#B7410E", name: "Rust" },
  ],
  secondarySwatches: [
    { hex: "#C19A6B", name: "Camel Again" }, // same hex as Camel: dropped
    { hex: "#800020", name: "camel" }, // same name as Camel: dropped
    { hex: "#FFDB58", name: "Mustard" },
    { hex: "#nothex", name: "Broken" }, // invalid hex: dropped
    { hex: "#36454F", name: "  Charcoal  " },
    { hex: "#F5F5DC", name: "" }, // no name: dropped
    { name: "No Hex" },
    "not a swatch",
    { hex: "#2E8B57", name: "Sea Green" },
    { hex: "#FFFDD0", name: "Cream" },
    { hex: "#E2725B", name: "Terracotta" }, // ninth valid: over the cap
  ],
  accentSwatches: [{ hex: "#FF7F50", name: "Coral" }], // never read
};

const V1_EXPECTED = [
  { name: "Saddle Brown", hex: "#8B4513" },
  { name: "Camel", hex: "#C19A6B" },
  { name: "Olive", hex: "#556B2F" },
  { name: "Rust", hex: "#B7410E" },
  { name: "Mustard", hex: "#FFDB58" },
  { name: "Charcoal", hex: "#36454F" },
  { name: "Sea Green", hex: "#2E8B57" },
  { name: "Cream", hex: "#FFFDD0" },
];

const V2_PROFILE = {
  version: 2,
  season: "Spring",
  primary: [
    { hex: "#FFE5A8", name: "Light Cream" },
    { hex: "#F7B7A3", name: "Peach Pastel" },
  ],
  secondary: [{ hex: "#C8E6C9", name: "Soft Mint" }],
  accent: [{ hex: "#FF8C61", name: "Warm Coral" }],
};

describe("memberSwatches", () => {
  test("reads primary and secondary swatches, dedupes, keeps at most 8, drops invalid hex, reads the v2 quiz shape", () => {
    expect(MAX_MEMBER_SWATCHES).toBe(8);
    expect(memberSwatches(V1_PROFILE)).toEqual(V1_EXPECTED);
    expect(memberSwatches(V2_PROFILE)).toEqual([
      { name: "Light Cream", hex: "#FFE5A8" },
      { name: "Peach Pastel", hex: "#F7B7A3" },
      { name: "Soft Mint", hex: "#C8E6C9" },
    ]);
  });

  test("primary comes before secondary", () => {
    const swatches = memberSwatches({
      secondarySwatches: [{ hex: "#000000", name: "Second" }],
      primarySwatches: [{ hex: "#FFFFFF", name: "First" }],
    });
    expect(swatches.map((s) => s.name)).toEqual(["First", "Second"]);
  });

  test("a profile with only one list still reads it", () => {
    expect(memberSwatches({ primarySwatches: [{ hex: "#000000", name: "Ink" }] })).toEqual([
      { name: "Ink", hex: "#000000" },
    ]);
    expect(memberSwatches({ secondary: [{ hex: "#000000", name: "Ink" }] })).toEqual([
      { name: "Ink", hex: "#000000" },
    ]);
  });

  test("an empty current list falls back to the v2 list", () => {
    expect(
      memberSwatches({
        primarySwatches: [],
        primary: [{ hex: "#FFE5A8", name: "Light Cream" }],
        secondarySwatches: [],
        secondary: [{ hex: "#C8E6C9", name: "Soft Mint" }],
      }),
    ).toEqual([
      { name: "Light Cream", hex: "#FFE5A8" },
      { name: "Soft Mint", hex: "#C8E6C9" },
    ]);
  });

  test("names are capped at 40 characters, then trimmed and deduped", () => {
    expect(MAX_SWATCH_NAME_LENGTH).toBe(40);
    const long = `${"Deep Burgundy ".repeat(2)}${"x".repeat(5000)}`;
    const swatches = memberSwatches({
      primarySwatches: [
        { hex: "#800020", name: long },
        { hex: "#000000", name: `${long.slice(0, 40)} and more` }, // same capped name: dropped
        { hex: "#FFFFFF", name: `${"a".repeat(39)} b` }, // capped to 39 a's and a space, trimmed
      ],
    });
    expect(swatches).toEqual([
      { name: long.slice(0, 40), hex: "#800020" },
      { name: "a".repeat(39), hex: "#FFFFFF" },
    ]);
    for (const swatch of swatches) expect(swatch.name.length).toBeLessThanOrEqual(40);
  });

  test("no profile, or an unreadable one, gives no swatches", () => {
    for (const value of [null, undefined, "Autumn", 3, [], {}, { primarySwatches: "x" }]) {
      expect(memberSwatches(value)).toEqual([]);
    }
  });

  test("never mutates her profile", () => {
    const copy = JSON.parse(JSON.stringify(V1_PROFILE));
    memberSwatches(V1_PROFILE);
    expect(V1_PROFILE).toEqual(copy);
  });
});
}
