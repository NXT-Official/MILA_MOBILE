import { lookSections, normalizeAnalysisResult } from "@/lib/outfit-history";

const dailyLook = {
  type: "daily_look",
  weather: "Partly Cloudy",
  vibe: "Brunch",
  vibe_alignment_score: 88,
  outfit: {
    headline: "The Architectural Linen Silhouette",
    description: "A wide-leg linen trouser.",
    styling_notes: "Cuff the hem once.",
  },
  hair: { style: "Low chignon", execution_tip: "Damp hair holds it." },
  makeup: { palette: "Warm neutrals", details: "Skip the liner." },
};

const lensAnalysis = {
  color_match: "Strong",
  silhouette: "Balanced",
  overall_score: 82,
  verdict: "This works.",
};

describe("normalizeAnalysisResult", () => {
  it("reads a saved daily look, including its weather and vibe", () => {
    const entry = normalizeAnalysisResult(dailyLook);
    expect(entry.kind).toBe("daily_look");
    if (entry.kind !== "daily_look") throw new Error("wrong branch");

    expect(entry.look.outfit.headline).toBe("The Architectural Linen Silhouette");
    expect(entry.look.hair.style).toBe("Low chignon");
    expect(entry.look.vibe_alignment_score).toBe(88);
    expect(entry.weather).toBe("Partly Cloudy");
    expect(entry.vibe).toBe("Brunch");
  });

  it("identifies a Lens analysis by its fields, since it carries no type tag", () => {
    const entry = normalizeAnalysisResult(lensAnalysis);
    expect(entry.kind).toBe("lens");
    if (entry.kind !== "lens") throw new Error("wrong branch");
    expect(entry.analysis.overall_score).toBe(82);
  });

  it("survives a truncated daily look rather than throwing mid-render", () => {
    const entry = normalizeAnalysisResult({ type: "daily_look", outfit: { headline: "Just this" } });
    expect(entry.kind).toBe("daily_look");
    if (entry.kind !== "daily_look") throw new Error("wrong branch");

    expect(entry.look.outfit.headline).toBe("Just this");
    expect(entry.look.hair.style).toBe("");
    // Absent stays absent. A missing score is not a score of zero: History
    // renders "Vibe fit X/10" only when there is one, as the web does.
    expect(entry.look.vibe_alignment_score).toBeNull();
    expect(entry.weather).toBeNull();
  });

  it("falls back to unavailable for anything it does not recognise", () => {
    expect(normalizeAnalysisResult(null).kind).toBe("unavailable");
    expect(normalizeAnalysisResult(undefined).kind).toBe("unavailable");
    expect(normalizeAnalysisResult("a string").kind).toBe("unavailable");
    expect(normalizeAnalysisResult([1, 2]).kind).toBe("unavailable");
    expect(normalizeAnalysisResult({ unrelated: true }).kind).toBe("unavailable");
  });
});

describe("lookSections", () => {
  it("returns Outfit, Hair and Makeup in the §3 order", () => {
    const entry = normalizeAnalysisResult(dailyLook);
    if (entry.kind !== "daily_look") throw new Error("wrong branch");

    const sections = lookSections(entry.look);
    expect(sections.map((s) => s.title)).toEqual(["Outfit", "Hair", "Makeup"]);
    expect(sections[0]?.body).toContain("wide-leg linen trouser");
    expect(sections[0]?.body).toContain("Cuff the hem once");
  });

  it("drops a section the server left empty instead of rendering a blank heading", () => {
    const entry = normalizeAnalysisResult({
      ...dailyLook,
      makeup: { palette: "", details: "" },
    });
    if (entry.kind !== "daily_look") throw new Error("wrong branch");

    expect(lookSections(entry.look).map((s) => s.title)).toEqual(["Outfit", "Hair"]);
  });
});

describe("normalizeAnalysisResult: the saved colour map", () => {
  const colourMap = [
    {
      kind: "outerwear",
      label: "Coat",
      title: "Wool Overcoat",
      wear: { name: "Charcoal", hex: "#36454F", role: "base" },
    },
    {
      kind: "top",
      label: "Shirt",
      title: "Silk Camp Shirt",
      wear: { name: "Cream", hex: "#FFFDD0", role: "statement" },
    },
    { kind: "bottoms", label: "Jeans", title: "Straight Jeans", wear: null },
  ];

  it("parses a saved colour map", () => {
    const entry = normalizeAnalysisResult({ ...dailyLook, colourMap });
    if (entry.kind !== "daily_look") throw new Error("wrong branch");
    expect(entry.look.colourMap).toEqual(colourMap);
  });

  it("ignores a malformed one", () => {
    for (const bad of ["x", 7, {}, [], [null, 3, "x"], [{ kind: "top" }]]) {
      const entry = normalizeAnalysisResult({ ...dailyLook, colourMap: bad });
      if (entry.kind !== "daily_look") throw new Error("wrong branch");
      expect(entry.look.colourMap).toBeUndefined();
    }
  });

  it("a colour that is not whole and safe reads as no colour, and the row stays", () => {
    const entry = normalizeAnalysisResult({
      ...dailyLook,
      colourMap: [
        { ...colourMap[0], wear: { name: "Charcoal", hex: "url(x)", role: "base" } },
        colourMap[1],
      ],
    });
    if (entry.kind !== "daily_look") throw new Error("wrong branch");
    expect(entry.look.colourMap).toEqual([{ ...colourMap[0], wear: null }, colourMap[1]]);
  });

  it("a look saved before the feature has no colour map", () => {
    const entry = normalizeAnalysisResult(dailyLook);
    if (entry.kind !== "daily_look") throw new Error("wrong branch");
    expect(entry.look.colourMap).toBeUndefined();
  });

  it("caps the map at 12 rows", () => {
    const many = Array.from({ length: 20 }, () => colourMap[1]);
    const entry = normalizeAnalysisResult({ ...dailyLook, colourMap: many });
    if (entry.kind !== "daily_look") throw new Error("wrong branch");
    expect(entry.look.colourMap).toHaveLength(12);
  });
});
