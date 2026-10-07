import { fireEvent, render } from "@testing-library/react-native";

import type { SavedPalette } from "@/services/supabase/palettes";

/**
 * Saved palettes: each one shows where to wear each colour, and an empty list
 * offers the way to make today's palette instead of a dead end.
 */
const mockQuery: {
  data: SavedPalette[] | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: jest.Mock;
  isRefetching: boolean;
} = { data: [], isPending: false, isError: false, refetch: jest.fn(), isRefetching: false };
const mockRemove = { mutate: jest.fn(), isPending: false };

jest.mock("../src/hooks/use-saved-palettes", () => ({
  useSavedPalettes: () => mockQuery,
  useDeleteSavedPalette: () => mockRemove,
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));

import { router } from "expo-router";

import { PalettesScreen } from "@/features/palettes/PalettesScreen";

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
    insight:
      "Wear Charcoal on your bottoms or a jacket, Rust on top near your face, and Camel on your shoes, bag or jewelry.",
    source: "swatches",
  },
};

const OLDER: SavedPalette = {
  id: "older",
  created_at: "2026-09-01T08:00:00Z",
  palette: {
    baseColor: "Sage Mist",
    statementColor: "Bone Ecru",
    accentColor: "Soft Coral",
    baseHex: "#C2D1B8",
    statementHex: "#EDE3D1",
    accentHex: "#EFA48A",
    isSisterSeasonIncluded: false,
    styleVibe: "Garden Light",
    insight: "Quiet neutrals up top, a single moment of colour to finish.",
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.data = [OWN, OLDER];
  mockQuery.isPending = false;
  mockQuery.isError = false;
});

describe("saved palettes", () => {
  it("wear line per role, on every saved palette, old ones included", async () => {
    const s = await render(<PalettesScreen />);

    expect(s.getAllByText("Bottoms or a jacket")).toHaveLength(2);
    expect(s.getAllByText("Top, near your face")).toHaveLength(2);
    expect(s.getAllByText("Shoes, bag or jewellery")).toHaveLength(2);
    expect(s.getAllByText("Base")).toHaveLength(2);
    expect(s.getAllByText("Statement")).toHaveLength(2);
    expect(s.getAllByText("Accent")).toHaveLength(2);
    // Every colour still carries its name.
    for (const name of ["Charcoal", "Rust", "Camel", "Sage Mist", "Bone Ecru", "Soft Coral"]) {
      expect(s.getByText(name)).toBeTruthy();
    }
  });

  it("writes a palette from her own colours in UK spelling, whatever US copy it was saved with", async () => {
    const s = await render(<PalettesScreen />);

    expect(s.getByText("From your colours")).toBeTruthy();
    expect(
      s.getByText(
        "Wear Charcoal on your bottoms or a jacket, Rust on top near your face, and Camel on your shoes, bag or jewellery.",
      ),
    ).toBeTruthy();
    expect(s.queryByText("From your colors")).toBeNull();
    // An older palette keeps the copy it was saved with.
    expect(s.getByText("Garden Light")).toBeTruthy();
  });

  it("the empty state offers to make today's palette", async () => {
    mockQuery.data = [];
    const s = await render(<PalettesScreen />);

    await fireEvent.press(s.getByRole("button", { name: "Make today's palette" }));
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(s.queryByText("Go to Home")).toBeNull();
  });

  it("the empty state has no dash", async () => {
    mockQuery.data = [];
    const s = await render(<PalettesScreen />);
    const text = JSON.stringify(s.toJSON());
    expect(text).not.toMatch(/[–—]/);
  });

  it("keeps its error state and retry", async () => {
    mockQuery.data = undefined;
    mockQuery.isError = true;
    const s = await render(<PalettesScreen />);

    await fireEvent.press(s.getByRole("button", { name: "Try again" }));
    expect(mockQuery.refetch).toHaveBeenCalledTimes(1);
  });
});
