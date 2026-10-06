import { garmentGlyphs } from "@/components/ui/garment-glyphs";

/**
 * The garment glyphs lucide-react-native does not ship, copied from
 * `@lucide/lab` 0.7.0 as node data. `Icon.tsx` builds them with lucide's own
 * `createLucideIcon`; the badge test renders every one through the registry.
 */
const ELEMENTS = ["circle", "ellipse", "g", "line", "path", "polygon", "polyline", "rect"];

test("exactly the thirteen glyphs the badge needs are copied", () => {
  expect(Object.keys(garmentGlyphs).sort()).toEqual(
    [
      "belt",
      "dress",
      "gemRing",
      "hatBowler",
      "highHeel",
      "jacket",
      "scarf",
      "shorts",
      "skirt",
      "sneaker",
      "socks",
      "trousers",
      "vest",
    ].sort(),
  );
});

test("every node is an SVG element with string attributes and a key, as lucide expects", () => {
  for (const node of Object.values(garmentGlyphs)) {
    expect(node.length).toBeGreaterThan(0);
    for (const [element, attrs] of node) {
      expect(ELEMENTS).toContain(element);
      expect(typeof attrs.key).toBe("string");
      for (const value of Object.values(attrs)) expect(typeof value).toBe("string");
    }
  }
});
