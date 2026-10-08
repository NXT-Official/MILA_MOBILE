import { fireEvent, render, within } from "@testing-library/react-native";

/**
 * History's search, sort and view by style category. The filtering itself is
 * `history-filter` (shared with the web, tested there and in
 * history-filter-test); this pins what she sees and does on the screen.
 */
const mockOutfits: { data: unknown; isPending: boolean; isError: boolean } = {
  data: [],
  isPending: false,
  isError: false,
};

jest.mock("../src/hooks/use-outfits", () => ({
  useOutfits: () => ({ ...mockOutfits, refetch: jest.fn(), isRefetching: false }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));

import { HistoryScreen } from "@/features/outfits/HistoryScreen";

function daily(headline: string, vibe: string, score: number, notes = "") {
  return {
    type: "daily_look",
    weather: "Partly Cloudy",
    vibe,
    vibe_alignment_score: score,
    outfit: { headline, description: notes, styling_notes: "" },
    hair: { style: "", execution_tip: "" },
    makeup: null,
  };
}

const ROWS = [
  {
    id: "a",
    image_url: "https://img.example.test/a.jpg",
    match_score: null,
    created_at: "2026-10-01T09:00:00Z",
    analysis_result: daily("Linen Day", "Brunch", 8, "Wide-leg linen trousers"),
  },
  {
    id: "b",
    image_url: "https://img.example.test/b.jpg",
    match_score: null,
    created_at: "2026-10-03T09:00:00Z",
    analysis_result: daily("Soft Tailoring", "Work or School", 9),
  },
  {
    id: "c",
    image_url: "https://img.example.test/c.jpg",
    match_score: null,
    created_at: "2026-09-20T20:00:00Z",
    analysis_result: daily("Garden Brunch", "Brunch", 6),
  },
  {
    id: "d",
    image_url: "https://img.example.test/d.jpg",
    match_score: 80,
    created_at: "2026-10-02T12:00:00Z",
    analysis_result: { overall_score: 80, verdict: "Navy reads cool.", color_match: "", silhouette: "" },
  },
];

const TITLES = /^(Linen Day|Soft Tailoring|Garden Brunch|Lens analysis)$/;
const shownTitles = (s: Awaited<ReturnType<typeof render>>) =>
  s.queryAllByText(TITLES).map((node) => node.props.children as string);

beforeEach(() => {
  mockOutfits.data = ROWS;
  mockOutfits.isPending = false;
  mockOutfits.isError = false;
});

describe("HistoryScreen search, sort and categories", () => {
  it("shows every saved look newest first, with the views she has", async () => {
    const s = await render(<HistoryScreen />);
    expect(shownTitles(s)).toEqual(["Soft Tailoring", "Lens analysis", "Linen Day", "Garden Brunch"]);
    const views = within(s.getByLabelText("Style category"));
    expect(views.getByRole("radio", { name: "All (4)" }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(views.getByRole("radio", { name: "Work or School (1)" })).toBeTruthy();
    expect(views.getByRole("radio", { name: "Brunch (2)" })).toBeTruthy();
    expect(views.getByRole("radio", { name: "Analyses (1)" })).toBeTruthy();
    expect(s.getByText("4 saved")).toBeTruthy();
  });

  it("search narrows the grid to what matches", async () => {
    const s = await render(<HistoryScreen />);
    await fireEvent.changeText(s.getByLabelText("Search History"), "linen");
    expect(shownTitles(s)).toEqual(["Linen Day"]);
    expect(s.getByText("Showing 1 of 4")).toBeTruthy();
  });

  it("a style category shows only its looks", async () => {
    const s = await render(<HistoryScreen />);
    await fireEvent.press(s.getByRole("radio", { name: "Brunch (2)" }));
    expect(shownTitles(s)).toEqual(["Linen Day", "Garden Brunch"]);
    expect(s.getByRole("radio", { name: "Brunch (2)" }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it("the sort sheet reorders the grid and closes", async () => {
    const s = await render(<HistoryScreen />);
    await fireEvent.press(s.getByRole("button", { name: "Sort: Newest first. Change." }));
    expect(s.getByText("Sort by")).toBeTruthy();
    await fireEvent.press(s.getByRole("radio", { name: "Best vibe fit" }));
    expect(s.queryByText("Sort by")).toBeNull();
    expect(shownTitles(s)).toEqual(["Soft Tailoring", "Linen Day", "Garden Brunch", "Lens analysis"]);
    expect(s.getByRole("button", { name: "Sort: Best vibe fit. Change." })).toBeTruthy();
  });

  it("a search that finds nothing says so, and Clear filters brings everything back", async () => {
    const s = await render(<HistoryScreen />);
    await fireEvent.press(s.getByRole("radio", { name: "Brunch (2)" }));
    await fireEvent.changeText(s.getByLabelText("Search History"), "velvet");
    expect(shownTitles(s)).toEqual([]);
    expect(s.getByText("No looks match")).toBeTruthy();
    await fireEvent.press(s.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(shownTitles(s)).toHaveLength(4);
    expect(s.getByLabelText("Search History").props.value).toBe("");
  });

  it("with nothing saved there is nothing to search, only the empty state", async () => {
    mockOutfits.data = [];
    const s = await render(<HistoryScreen />);
    expect(s.getByText("Nothing saved yet")).toBeTruthy();
    expect(s.queryByLabelText("Search History")).toBeNull();
    expect(s.queryByLabelText("Style category")).toBeNull();
  });
});
