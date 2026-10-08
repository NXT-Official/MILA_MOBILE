import { render } from "@testing-library/react-native";

import { ColourMap } from "@/components/ui/ColourMap";
import { WearColourChip } from "@/components/ui/WearColourChip";
import type { SavedColourMapRow } from "@/lib/wear-colour";

const ROWS: SavedColourMapRow[] = [
  { kind: "outerwear", label: "Coat", title: "Wool Overcoat", wear: { name: "Charcoal", hex: "#36454F", role: "base" } },
  { kind: "top", label: "Shirt", title: "Silk Camp Shirt", wear: { name: "Cream", hex: "#FFFDD0", role: "statement" } },
  { kind: "bag", label: "Tote", title: "Leather Tote", wear: { name: "Camel", hex: "#C19A6B", role: "accent" } },
  { kind: "bottoms", label: "Jeans", title: "Straight Jeans", wear: null },
];

describe("ColourMap", () => {
  it("one row per piece with the colour name and role words, under a UK-spelt heading", async () => {
    const s = await render(<ColourMap rows={ROWS} />);
    expect(s.getByText("Your colour map")).toBeTruthy();
    expect(s.getByText("Wear each piece in one of your colours.")).toBeTruthy();
    for (const label of ["Coat", "Shirt", "Tote", "Jeans"]) expect(s.getByText(label)).toBeTruthy();
    expect(s.getByText("Charcoal")).toBeTruthy();
    expect(s.getByText("Base · Bottoms and outer layers")).toBeTruthy();
    expect(s.getByText("Cream")).toBeTruthy();
    expect(s.getByText("Statement · Near your face")).toBeTruthy();
    expect(s.getByText("Camel")).toBeTruthy();
    expect(s.getByText("Accent · Shoes, bag and jewellery")).toBeTruthy();
    expect(s.getByText("No colour picked for this piece.")).toBeTruthy();
  });

  it("an old look, or one with no colour at all, shows nothing", async () => {
    const none = await render(<ColourMap rows={[]} />);
    expect(none.toJSON()).toBeNull();
    const uncoloured = await render(<ColourMap rows={ROWS.map((row) => ({ ...row, wear: null }))} />);
    expect(uncoloured.toJSON()).toBeNull();
  });

  it("labels are never carried by colour alone: every swatch is hidden from assistive tech", async () => {
    const s = await render(<ColourMap rows={ROWS} />);
    const dots = s.getAllByTestId("colour-dot", { includeHiddenElements: true });
    expect(dots.length).toBeGreaterThanOrEqual(4);
    for (const dot of dots) {
      expect(dot.props.accessibilityElementsHidden).toBe(true);
      expect(dot.props.importantForAccessibility).toBe("no-hide-descendants");
    }
  });

  it("paints her hex, and a row with no colour paints nothing", async () => {
    const s = await render(<ColourMap rows={ROWS} />);
    const styles = s
      .getAllByTestId("colour-dot", { includeHiddenElements: true })
      .map((dot) => String(JSON.stringify(dot.props.style)));
    expect(styles).toHaveLength(4);
    expect(styles.filter((style) => /#36454F|#FFFDD0|#C19A6B/.test(style))).toHaveLength(3);
    expect(styles.filter((style) => style.includes("backgroundColor"))).toHaveLength(3);
  });

  it("a stored colour that is not a whole, safe colour reads as no colour", async () => {
    const s = await render(
      <ColourMap
        rows={[
          { ...ROWS[0], wear: { name: "Charcoal", hex: "url(x)", role: "base" } as never },
          ROWS[1],
        ]}
      />,
    );
    expect(JSON.stringify(s.toJSON())).not.toContain("url(x)");
    expect(s.getByText("No colour picked for this piece.")).toBeTruthy();
  });

  it("the place words show only when the role is where the piece sits", async () => {
    const s = await render(
      <ColourMap
        rows={[
          { kind: "shoes", label: "Heels", title: "Patent Heels", wear: { name: "Red", hex: "#C0392B", role: "statement" } },
          { kind: "top", label: "Top", title: "Fitted Top", wear: { name: "Navy", hex: "#1F2A44", role: "base" } },
        ]}
      />,
    );
    expect(s.getByText("Statement")).toBeTruthy();
    expect(s.getByText("Base")).toBeTruthy();
    expect(s.queryByText(/Near your face/)).toBeNull();
    expect(s.queryByText(/Bottoms and outer layers/)).toBeNull();
    expect(s.queryByText(/Shoes, bag and jewellery/)).toBeNull();
  });

  it("each row is one screen-reader stop with a combined label", async () => {
    const s = await render(<ColourMap rows={ROWS} />);
    expect(s.getByLabelText("Coat. Charcoal. Base, bottoms and outer layers")).toBeTruthy();
    expect(s.getByLabelText("Shirt. Cream. Statement, near your face")).toBeTruthy();
    expect(s.getByLabelText("Tote. Camel. Accent, shoes, bag and jewellery")).toBeTruthy();
    expect(s.getByLabelText("Jeans. No colour picked for this piece")).toBeTruthy();
  });

  it("never renders US spelling or a dash", async () => {
    const s = await render(<ColourMap rows={ROWS} />);
    const all = JSON.stringify(s.toJSON());
    expect(all).not.toMatch(/\bcolor/i);
    expect(all).not.toMatch(/jewelry/i);
    expect(all).not.toMatch(/[–—]/);
  });
});

describe("WearColourChip", () => {
  const OLIVE = { name: "Olive", hex: "#556B2F", role: "base" } as const;

  it("names the colour as visible text beside a decorative dot", async () => {
    const s = await render(<WearColourChip wear={OLIVE} />);
    expect(s.getByText("Olive")).toBeTruthy();
    const dot = s.getByTestId("colour-dot", { includeHiddenElements: true });
    expect(dot.props.accessibilityElementsHidden).toBe(true);
  });

  it("tells a screen reader what the colour is for", async () => {
    const s = await render(<WearColourChip wear={OLIVE} />);
    expect(s.getByLabelText("Wear it in Olive")).toBeTruthy();
  });

  it("renders nothing without a whole, safe colour", async () => {
    expect((await render(<WearColourChip wear={null} />)).toJSON()).toBeNull();
    expect((await render(<WearColourChip wear={undefined} />)).toJSON()).toBeNull();
    expect(
      (await render(<WearColourChip wear={{ name: "Olive", hex: "url(x)", role: "base" } as never} />)).toJSON(),
    ).toBeNull();
  });
});
