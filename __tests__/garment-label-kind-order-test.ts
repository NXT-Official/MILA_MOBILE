import { GARMENT_KIND_DEFAULTS, GARMENT_KIND_ORDER, productName } from "@/lib/garment-label";

/**
 * The two exports the colour map reads, mirrored from the web's
 * `garment-label.ts` (wear-colour.ts is copied verbatim and imports them).
 */
describe("productName", () => {
  it("keeps only the name before the first bar", () => {
    expect(productName("Baggy Chino | Trench Coat Khaki | 30L")).toBe("Baggy Chino");
    expect(productName("The Pull-On Performance Chino Short | Khaki")).toBe(
      "The Pull-On Performance Chino Short",
    );
  });

  it("a title with no bar is its own name", () => {
    expect(productName("Hat Bead Charm")).toBe("Hat Bead Charm");
  });
});

describe("GARMENT_KIND_ORDER", () => {
  it("is head to toe, outerwear first and unknown last", () => {
    expect(GARMENT_KIND_ORDER).toEqual([
      "outerwear",
      "top",
      "dress",
      "bottoms",
      "shoes",
      "bag",
      "jewelry",
      "accessory",
      "unknown",
    ]);
  });

  it("gives every kind exactly one place", () => {
    expect([...GARMENT_KIND_ORDER].sort()).toEqual(Object.keys(GARMENT_KIND_DEFAULTS).sort());
  });
});
