import {
  MAX_DETECTED_ITEMS,
  normalizeSourceUrl,
  parseDetectedItems,
  sourceUrlHost,
} from "@/lib/outfit-items";

/**
 * `lib/outfit-items.ts` is a verbatim copy of the web's (Appendix A). This test
 * exists so a re-copy that lands wrong is caught here rather than as hotspots
 * bunched in a corner of someone's photograph.
 */

function item(overrides: Record<string, unknown> = {}) {
  return {
    name: "Linen blazer",
    category: "Outerwear",
    primary_color: "Oat",
    color_undertone: "Warm",
    silhouette_tags: ["structured", "oversized"],
    bbox: { x: 0.2, y: 0.1, w: 0.4, h: 0.5 },
    ...overrides,
  };
}

describe("parseDetectedItems", () => {
  it("keeps a well-formed 0-1 bbox as-is", () => {
    const [parsed] = parseDetectedItems([item()]);
    expect(parsed.bbox).toEqual({ x: 0.2, y: 0.1, w: 0.4, h: 0.5 });
    expect(parsed.label).toBe("Linen blazer");
  });

  it("rescales a 0-1000 bbox, the scale Gemini actually documents", () => {
    // Without this every hotspot clamps into the top-left corner and reads as a
    // detection bug rather than a units bug.
    const [parsed] = parseDetectedItems([item({ bbox: { x: 200, y: 100, w: 400, h: 500 } })]);
    expect(parsed.bbox).toEqual({ x: 0.2, y: 0.1, w: 0.4, h: 0.5 });
  });

  it("rescales a percent bbox", () => {
    const [parsed] = parseDetectedItems([item({ bbox: { x: 20, y: 10, w: 40, h: 50 } })]);
    expect(parsed.bbox).toEqual({ x: 0.2, y: 0.1, w: 0.4, h: 0.5 });
  });

  it("treats a slight overrun of the frame as fractional, not percent", () => {
    // 1.5 rather than 1: a box may legitimately spill past the edge a little,
    // and reading that as percent units would shrink it to nothing.
    const [parsed] = parseDetectedItems([item({ bbox: { x: 0.1, y: 0.1, w: 1.0, h: 1.2 } })]);
    expect(parsed.bbox.w).toBeGreaterThan(0.5);
  });

  it("drops one malformed garment without losing the outfit", () => {
    const parsed = parseDetectedItems([
      item({ name: "Silk shirt" }),
      item({ category: "Spacesuit" }),
      item({ name: "Leather boot" }),
    ]);
    expect(parsed.map((p) => p.label)).toEqual(["Silk shirt", "Leather boot"]);
  });

  it("drops an item whose box collapses to nothing", () => {
    expect(parseDetectedItems([item({ bbox: { x: 0.5, y: 0.5, w: 0, h: 0.2 } })])).toEqual([]);
  });

  it("drops an item with a blank name", () => {
    expect(parseDetectedItems([item({ name: "   " })])).toEqual([]);
  });

  it("caps a runaway response", () => {
    const many = Array.from({ length: MAX_DETECTED_ITEMS + 5 }, () => item());
    expect(parseDetectedItems(many)).toHaveLength(MAX_DETECTED_ITEMS);
  });

  it("returns nothing for a non-array", () => {
    expect(parseDetectedItems(null)).toEqual([]);
    expect(parseDetectedItems({ items: [] })).toEqual([]);
  });
});

describe("normalizeSourceUrl", () => {
  it("accepts https", () => {
    expect(normalizeSourceUrl("https://example.com/coat")).toBe("https://example.com/coat");
  });

  it("rejects http, which the server refuses rather than silently drops", () => {
    expect(normalizeSourceUrl("http://example.com")).toBeNull();
  });

  it("rejects a javascript: URL", () => {
    expect(normalizeSourceUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects a malformed URL and an empty string", () => {
    expect(normalizeSourceUrl("not a url")).toBeNull();
    expect(normalizeSourceUrl("   ")).toBeNull();
  });
});

describe("sourceUrlHost", () => {
  it("shows the bare host, so a link cannot dress itself as another domain", () => {
    expect(sourceUrlHost("https://www.net-a-porter.com/en-gb/shop/product/123")).toBe(
      "net-a-porter.com",
    );
  });

  it("degrades to a word rather than throwing", () => {
    expect(sourceUrlHost("nonsense")).toBe("link");
  });
});
