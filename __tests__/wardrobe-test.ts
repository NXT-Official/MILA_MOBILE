import { CLOTHING_CATEGORIES } from "@/constants/wardrobe";
import { ClothingAttributesSchema } from "@/lib/outfit-items";
import { garmentFor } from "@/lib/garment-label";

describe("CLOTHING_CATEGORIES", () => {
  it("matches the web catalogue, Bags and Jewelry included", () => {
    expect([...CLOTHING_CATEGORIES]).toEqual([
      "Tops",
      "Bottoms",
      "Outerwear",
      "Dresses",
      "Shoes",
      "Accessories",
      "Bags",
      "Jewelry",
    ]);
  });

  it.each(["Bags", "Jewelry"])("%s is accepted as a detected item category", (category) => {
    const parsed = ClothingAttributesSchema.safeParse({
      name: "Piece",
      category,
      primary_color: "black",
      color_undertone: "Neutral",
      silhouette_tags: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("every category resolves to a known garment kind, never the fallback", () => {
    for (const category of CLOTHING_CATEGORIES) {
      expect(garmentFor(category).kind).not.toBe("unknown");
    }
  });
});
