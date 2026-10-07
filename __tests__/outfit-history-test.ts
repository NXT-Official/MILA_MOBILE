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

describe("saved shoppable picks", () => {
  const pick = {
    id: "p1",
    title: "Silk Blouse",
    brand_id: "b1",
    category: "Tops",
    price: 120,
    currency: "USD",
    image_url: "https://img.example/a.jpg",
    affiliate_link: "https://shop.example/p1",
    verification_status: "verified",
    last_verified_at: "2026-10-01T00:00:00Z",
    rationale: "Suits the palette.",
  };

  it("reads the picks saved with the look, links intact", () => {
    const entry = normalizeAnalysisResult({ ...dailyLook, shoppable_picks: [pick] });
    if (entry.kind !== "daily_look") throw new Error("wrong branch");

    expect(entry.look.shoppable_picks).toHaveLength(1);
    expect(entry.look.shoppable_picks?.[0]?.title).toBe("Silk Blouse");
    expect(entry.look.shoppable_picks?.[0]?.affiliate_link).toBe("https://shop.example/p1");
  });

  it("keeps an empty saved array empty — the grid renders its own empty copy", () => {
    const entry = normalizeAnalysisResult({ ...dailyLook, shoppable_picks: [] });
    if (entry.kind !== "daily_look") throw new Error("wrong branch");
    expect(entry.look.shoppable_picks).toEqual([]);
  });

  it("leaves rows saved before the field existed undefined — the section hides", () => {
    const entry = normalizeAnalysisResult(dailyLook);
    if (entry.kind !== "daily_look") throw new Error("wrong branch");
    expect(entry.look.shoppable_picks).toBeUndefined();
  });

  it("drops a pick whose link is not http(s) and nulls a non-http image", () => {
    const entry = normalizeAnalysisResult({
      ...dailyLook,
      shoppable_picks: [
        pick,
        { ...pick, id: "evil", affiliate_link: "javascript:alert(1)" },
        { ...pick, id: "img", image_url: "data:image/png;base64,xx" },
      ],
    });
    if (entry.kind !== "daily_look") throw new Error("wrong branch");

    expect(entry.look.shoppable_picks?.map((item) => item.id)).toEqual(["p1", "img"]);
    expect(entry.look.shoppable_picks?.[1]?.image_url).toBeNull();
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
