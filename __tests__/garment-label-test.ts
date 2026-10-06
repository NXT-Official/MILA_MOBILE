import {
  GARMENT_KEYWORDS,
  GARMENT_KIND_DEFAULTS,
  garmentFor,
  type GarmentKind,
} from "@/lib/garment-label";

/**
 * Every recommended product photo shows a whole outfit, so the badge has to
 * say which piece Mila means. The catalogue's category decides the kind; the
 * title only sharpens the words ("Jeans" rather than "Bottoms"), except where
 * the catalogue is known to file things in the wrong drawer (a clutch under
 * Accessories is a bag).
 */
describe("garmentFor", () => {
  it.each<[string, GarmentKind, string]>([
    ["Tops", "top", "Top"],
    ["Bottoms", "bottoms", "Bottoms"],
    ["Dresses", "dress", "Dress"],
    ["Outerwear", "outerwear", "Outerwear"],
    ["Shoes", "shoes", "Shoes"],
    ["Bags", "bag", "Bag"],
    ["Jewelry", "jewelry", "Jewelry"],
    ["Accessories", "accessory", "Accessory"],
  ])("the %s category is a %s, labelled %s, when the title adds nothing", (category, kind, label) => {
    const garment = garmentFor(category, "Classic everyday piece");
    expect(garment.kind).toBe(kind);
    expect(garment.label).toBe(label);
  });

  it("reads the category without caring about case or stray spaces", () => {
    expect(garmentFor("  tOPs ", null).kind).toBe("top");
    expect(garmentFor("JEWELRY").kind).toBe("jewelry");
  });

  it("names an unknown or missing category plainly instead of guessing", () => {
    // An unknown category keeps its own word (as the web does); no category at all is a "Piece".
    expect(garmentFor("Swimwear", "Classic piece")).toMatchObject({ kind: "unknown", label: "Swimwear" });
    expect(garmentFor(null, null)).toMatchObject({ kind: "unknown", label: "Piece" });
    expect(garmentFor(undefined)).toMatchObject({ kind: "unknown", label: "Piece" });
  });

  it.each<[string, string, string]>([
    ["Bottoms", "Wide-leg jeans", "Jeans"],
    ["Bottoms", "Pleated midi skirt", "Skirt"],
    ["Bottoms", "Linen shorts", "Shorts"],
    ["Bottoms", "Tailored trousers", "Trousers"],
    ["Outerwear", "Double-breasted wool coat", "Coat"],
    ["Outerwear", "Quilted vest", "Vest"],
    ["Outerwear", "Cropped blazer", "Blazer"],
    ["Shoes", "Pointed heels", "Heels"],
    ["Shoes", "Leather ankle boots", "Boots"],
    ["Shoes", "Court sneakers", "Sneakers"],
    ["Jewelry", "Gold hoop earrings", "Earrings"],
    ["Jewelry", "Pearl necklace", "Necklace"],
    ["Jewelry", "Signet ring", "Ring"],
    ["Jewelry", "Steel watch", "Watch"],
    ["Accessories", "Straw hat", "Hat"],
    ["Accessories", "Woven belt", "Belt"],
    ["Accessories", "Ribbed socks", "Socks"],
    ["Accessories", "Silk scarf", "Scarf"],
    ["Accessories", "Tortoiseshell sunglasses", "Sunglasses"],
  ])("%s + %j is labelled %s", (category, title, label) => {
    expect(garmentFor(category, title).label).toBe(label);
  });

  it("matches whole words only", () => {
    // "earrings" contains "ring"; "hatband" contains "hat".
    expect(garmentFor("Jewelry", "Drop earrings").label).toBe("Earrings");
    expect(garmentFor("Accessories", "Hatband trim").label).toBe("Accessory");
    expect(garmentFor("Jewelry", "Ringed bangle").label).toBe("Bracelet");
  });

  it("treats a hyphen as a word break", () => {
    expect(garmentFor("Tops", "Organic T-shirt").label).toBe("T-shirt");
  });

  it("moves a clutch or bag filed under Accessories into bags", () => {
    expect(garmentFor("Accessories", "Leather clutch")).toMatchObject({ kind: "bag", label: "Clutch" });
    expect(garmentFor("Accessories", "Mini shoulder bag")).toMatchObject({ kind: "bag", label: "Bag" });
    // A belt bag is a bag, not a belt.
    expect(garmentFor("Accessories", "Leather belt bag")).toMatchObject({
      kind: "bag",
      label: "Belt bag",
    });
  });

  it("keeps earrings filed under Accessories on that shelf, as the web does", () => {
    // Only bags (and a watch or charm) may move off the Accessories shelf. Earrings
    // there are not a confident enough answer to relabel: the category label stands.
    expect(garmentFor("Accessories", "Gold earrings")).toMatchObject({
      kind: "accessory",
      label: "Accessory",
    });
  });

  it("never lets a title override a definite category", () => {
    // A "jacket" in Tops is still a top; the badge must agree with the shelf.
    expect(garmentFor("Tops", "Cropped jacket")).toMatchObject({ kind: "top", label: "Top" });
    expect(garmentFor("Outerwear", "Coat with a belt")).toMatchObject({ kind: "outerwear", label: "Coat" });
  });

  it("gives every result an icon from the garment set", () => {
    expect(garmentFor("Bottoms", "Skirt").icon).toBe("skirt");
    expect(garmentFor("Jewelry", "Ring").icon).toBe("ring");
    expect(garmentFor("Tops").icon).toBe("shirt");
    expect(garmentFor(null).icon).toBe("tag");
  });
});

describe("the keyword table", () => {
  it("is one exported list, each entry with words, a kind, a label and an icon", () => {
    expect(GARMENT_KEYWORDS.length).toBeGreaterThan(0);
    for (const entry of GARMENT_KEYWORDS) {
      expect(entry.words.length).toBeGreaterThan(0);
      // Normalised like a title: lowercase words and digits, single spaces.
      for (const word of entry.words) expect(word).toMatch(/^[a-z0-9]+( [a-z0-9]+)*$/);
      expect(entry.label.trim()).not.toBe("");
      // The shelves it may name a piece on, and (optionally) the kind it moves the piece to.
      expect(entry.within.length).toBeGreaterThan(0);
      for (const shelf of entry.within) expect(Object.keys(GARMENT_KIND_DEFAULTS)).toContain(shelf);
      if (entry.kind) expect(Object.keys(GARMENT_KIND_DEFAULTS)).toContain(entry.kind);
    }
  });

  it("covers every keyword the owner named", () => {
    const words = new Set(GARMENT_KEYWORDS.flatMap((entry) => entry.words));
    for (const word of [
      "jeans",
      "skirt",
      "shorts",
      "coat",
      "vest",
      "heels",
      "clutch",
      "earrings",
      "necklace",
      "ring",
      "hat",
      "belt",
      "socks",
      "scarf",
      "sunglasses",
      "watch",
    ]) {
      expect(words).toContain(word);
    }
  });

  it("writes no dash characters into a label", () => {
    const labels = [
      ...GARMENT_KEYWORDS.map((entry) => entry.label),
      ...Object.values(GARMENT_KIND_DEFAULTS).map((entry) => entry.label),
    ];
    for (const label of labels) expect(label).not.toMatch(/[–—]/);
  });
});
