import { isDailyPalette, paletteSwatches } from "@/lib/saved-palette";
import { errorMessage } from "@/utils/error-message";

const VALID = {
  baseColor: "Sage Mist",
  statementColor: "Bone Ecru",
  accentColor: "Soft Coral",
  baseHex: "#9caf88",
  statementHex: "#e8e0d5",
  accentHex: "#e08a70",
  isSisterSeasonIncluded: false,
  styleVibe: "Everyday Casual",
  insight: "A grounded base with one signature lift.",
};

/**
 * `saved_palettes.palette` is JSONB, so a row written by an older client is a
 * real possibility. Both clients must skip the same rows — a palette that shows
 * on the web and renders half-formed on the phone is the failure this prevents.
 */
describe("isDailyPalette", () => {
  it("accepts a complete palette", () => {
    expect(isDailyPalette(VALID)).toBe(true);
  });

  it("rejects a palette missing a hex", () => {
    const { accentHex: _dropped, ...incomplete } = VALID;
    expect(isDailyPalette(incomplete)).toBe(false);
  });

  it("rejects a palette missing a name, which is the part that carries meaning", () => {
    const { statementColor: _dropped, ...incomplete } = VALID;
    expect(isDailyPalette(incomplete)).toBe(false);
  });

  it("rejects a non-boolean sister-season flag", () => {
    expect(isDailyPalette({ ...VALID, isSisterSeasonIncluded: "no" })).toBe(false);
  });

  it("rejects a numeric field where a string is required", () => {
    expect(isDailyPalette({ ...VALID, insight: 42 })).toBe(false);
  });

  it("rejects nothing at all", () => {
    expect(isDailyPalette(null)).toBe(false);
    expect(isDailyPalette(undefined)).toBe(false);
    expect(isDailyPalette("a palette")).toBe(false);
  });
});

describe("paletteSwatches", () => {
  it("pairs every hex with a role and a name — never a bare colour", () => {
    expect(paletteSwatches(VALID)).toEqual([
      { role: "Base layer", name: "Sage Mist", hex: "#9caf88" },
      { role: "Statement", name: "Bone Ecru", hex: "#e8e0d5" },
      { role: "Accent pop", name: "Soft Coral", hex: "#e08a70" },
    ]);
  });
});

describe("errorMessage", () => {
  it("uses an Error's message", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("reads Supabase's PostgrestError, which is not an Error instance", () => {
    // The whole reason this function exists: an `instanceof Error` check alone
    // silently swallows every database message.
    const postgrestError = {
      code: "42501",
      message: "permission denied for table saved_palettes",
      details: null,
      hint: null,
    };
    expect(errorMessage(postgrestError, "fallback")).toBe(
      "permission denied for table saved_palettes",
    );
  });

  it("falls back for shapes with nothing useful to show", () => {
    expect(errorMessage({ message: "" }, "fallback")).toBe("fallback");
    expect(errorMessage({ message: 42 }, "fallback")).toBe("fallback");
    expect(errorMessage("just a string", "fallback")).toBe("fallback");
    expect(errorMessage(null, "fallback")).toBe("fallback");
  });
});
