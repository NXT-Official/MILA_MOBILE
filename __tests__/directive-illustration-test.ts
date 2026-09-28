import {
  HAIR_DIRECTION,
  MAKEUP_HARMONY,
  SILHOUETTE_STRATEGY,
  TEXTILE_DIRECTION,
} from "@/constants/style-profile";
import { ITEM_ILLUSTRATIONS } from "@/features/studio/components/ItemIllustration";

// Every named item a styling note points at is either a colour or a piece to
// picture: colours carry a hex (the inline swatch is their visual), everything
// else needs a drawing — a missing one renders a bare text row rather than
// failing loudly.
describe("directive item illustrations", () => {
  const items = [
    ...Object.values(SILHOUETTE_STRATEGY),
    ...Object.values(HAIR_DIRECTION),
    ...Object.values(MAKEUP_HARMONY),
    ...Object.values(TEXTILE_DIRECTION),
  ].flatMap((directive) => directive.items);

  it("draws every item that carries no colour of its own", () => {
    for (const item of items) {
      if (item.hex) continue;
      expect(Object.keys(ITEM_ILLUSTRATIONS)).toContain(item.term);
    }
  });

  it("has no drawing that nothing points at", () => {
    const terms = new Set(items.map((item) => item.term));
    for (const term of Object.keys(ITEM_ILLUSTRATIONS)) {
      expect(terms.has(term)).toBe(true);
    }
  });
});
