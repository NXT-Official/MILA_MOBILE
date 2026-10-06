import { render } from "@testing-library/react-native";

import { GarmentBadge, recommendingLabel } from "@/components/ui/GarmentBadge";
import { garmentGlyphs } from "@/components/ui/garment-glyphs";
import { icons } from "@/components/ui/Icon";
import {
  GARMENT_KEYWORDS,
  GARMENT_KIND_DEFAULTS,
  garmentFor,
  type GarmentIcon,
} from "@/lib/garment-label";

/**
 * The badge that says which piece of a whole-outfit photo Mila is
 * recommending. It is never icon-only: the word is always on screen, and the
 * glyph beside it is decoration for sighted readers.
 */
describe("GarmentBadge", () => {
  it("shows the garment's name as text", async () => {
    const s = await render(<GarmentBadge garment={garmentFor("Bottoms", "Wide-leg jeans")} />);
    expect(s.getByText("Jeans")).toBeTruthy();
  });

  it("tells a screen reader what Mila is recommending", async () => {
    const s = await render(<GarmentBadge garment={garmentFor("Accessories", "Leather clutch")} />);
    const badge = s.getByLabelText("Mila is recommending the clutch");
    // On a View, not a Pressable: Pressable drops unknown props on the way down.
    expect(badge.type).toBe("View");
  });

  it("hides its glyph from assistive tech, so the label is read once", async () => {
    const s = await render(<GarmentBadge garment={garmentFor("Tops")} />);
    // The only image a screen reader meets is the badge itself, by its sentence.
    const images = s.getAllByRole("image");
    expect(images).toHaveLength(1);
    expect(images[0].props.accessibilityLabel).toBe("Mila is recommending the top");
  });

  it("has a role, so the web build reads its name", async () => {
    // react-native-web drops a name on an element with no role (ARIA forbids
    // naming the generic role); "image" maps to role="img", which is read.
    // src: react-native-web 0.21.2 · dist/modules/AccessibilityUtil/propsToAriaRole.js
    //   (image -> img, text -> no role)
    const s = await render(<GarmentBadge garment={garmentFor("Bottoms", "Wide-leg jeans")} />);
    expect(s.getByLabelText("Mila is recommending the jeans").props.accessibilityRole).toBe("image");
  });

  it("phrases the sentence in lower case after 'the'", () => {
    expect(recommendingLabel("Sunglasses")).toBe("Mila is recommending the sunglasses");
  });

  it("draws a copied lab glyph's own paths, not an empty svg", async () => {
    const s = await render(<GarmentBadge garment={garmentFor("Bottoms", "Pleated skirt")} />);
    const drawn = JSON.stringify(s.toJSON());
    for (const [, attrs] of garmentGlyphs.skirt) {
      if (attrs.d) expect(drawn).toContain(attrs.d);
    }
  });

  it("can draw every glyph the labeller can name", async () => {
    const names = new Set<GarmentIcon>([
      ...GARMENT_KEYWORDS.map((entry) => entry.icon),
      ...Object.values(GARMENT_KIND_DEFAULTS).map((entry) => entry.icon),
    ]);
    for (const name of names) {
      expect(icons[name]).toBeTruthy();
      const s = await render(
        <GarmentBadge garment={{ kind: "unknown", label: name, icon: name }} />,
      );
      expect(s.getByText(name)).toBeTruthy();
    }
  });
});
