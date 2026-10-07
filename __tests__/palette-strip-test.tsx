import { render } from "@testing-library/react-native";

import type { SavedPalette } from "@/services/supabase/palettes";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

import { PaletteStrip } from "@/features/studio/components/PaletteStrip";

const OWN: SavedPalette = {
  id: "own",
  created_at: "2026-10-07T08:00:00Z",
  palette: {
    baseColor: "Charcoal",
    statementColor: "Rust",
    accentColor: "Camel",
    baseHex: "#36454F",
    statementHex: "#B7410E",
    accentHex: "#C19A6B",
    isSisterSeasonIncluded: false,
    styleVibe: "From your colors",
    insight: "x",
    source: "swatches",
  },
};

const OLDER: SavedPalette = {
  ...OWN,
  id: "older",
  palette: { ...OWN.palette, styleVibe: "Garden Light", source: undefined },
};

describe("PaletteStrip", () => {
  it("shows a saved swatches palette as colours, in the label and under the tile", async () => {
    const s = await render(<PaletteStrip palettes={[OWN]} loading={false} />);

    expect(s.getByText("From your colours")).toBeTruthy();
    expect(s.queryByText("From your colors")).toBeNull();
    expect(
      s.getByLabelText("From your colours palette: Charcoal, Rust, Camel"),
    ).toBeTruthy();
  });

  it("leaves an older palette's own vibe alone", async () => {
    const s = await render(<PaletteStrip palettes={[OLDER]} loading={false} />);

    expect(s.getByText("Garden Light")).toBeTruthy();
    expect(s.getByLabelText("Garden Light palette: Charcoal, Rust, Camel")).toBeTruthy();
  });
});
