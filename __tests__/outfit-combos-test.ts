import { NAMED_PALETTE, SEASONS } from "@/constants/style-profile";
import { combosFor } from "@/lib/style-profile/outfit-combos";

/**
 * `combosFor()` is copied verbatim from the web, and so is the `NAMED_PALETTE`
 * it reads. These pin the one property that matters on both clients: a combo
 * only ever names a colour the member can find in the palette bands above it.
 */

describe("combosFor", () => {
  it.each(SEASONS)("gives %s four three-colour combos from its own palette", (season) => {
    const combos = combosFor(season);
    expect(combos).toHaveLength(4);

    const known = new Set(
      [
        ...NAMED_PALETTE[season].primary,
        ...NAMED_PALETTE[season].accents,
        ...NAMED_PALETTE[season].neutrals,
      ].map((swatch) => swatch.name),
    );

    for (const combo of combos) {
      expect(combo.hexes).toHaveLength(3);
      expect(combo.names).toHaveLength(3);
      expect(combo.note).not.toBe("");
      for (const name of combo.names) expect(known.has(name)).toBe(true);
    }
  });

  it("keeps hexes and names aligned", () => {
    const first = combosFor("Summer")[0];
    const primary = NAMED_PALETTE.Summer.primary;
    expect(first?.names[0]).toBe(primary[0]?.name);
    expect(first?.hexes[0]).toBe(primary[0]?.hex);
  });

  it("gives every combo a stable, unique id", () => {
    const ids = combosFor("Winter").map((combo) => combo.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
