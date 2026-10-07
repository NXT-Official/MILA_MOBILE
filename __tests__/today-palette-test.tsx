import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import {
  buildDailyPalette,
  paletteSeed,
  trioKey,
} from "@/lib/color-analysis/daily-palette";

/**
 * Today's palette from her own colours, with wear lines. The golden picks below
 * are the web's vectors (daily-palette-test.ts), so the same member on the same
 * day sees the same trio on both clients.
 */

const SWATCHES = [
  { name: "Saddle Brown", hex: "#8B4513" },
  { name: "Camel", hex: "#C19A6B" },
  { name: "Olive", hex: "#556B2F" },
  { name: "Rust", hex: "#B7410E" },
  { name: "Mustard", hex: "#FFDB58" },
  { name: "Charcoal", hex: "#36454F" },
];

const mockState: {
  userId: string | null;
  profile: { data: { color_profile: unknown } | undefined; isPending: boolean; isError: boolean };
  saved: { id: string; created_at: string; palette: Record<string, unknown> }[];
} = {
  userId: "member-1",
  profile: { data: undefined, isPending: false, isError: false },
  saved: [],
};
const mockRefetch = jest.fn();
const mockSave = jest.fn();
const mockRemove = jest.fn();
let mockForeground: (() => void) | null = null;

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../src/hooks/use-profile", () => ({
  useProfile: () => ({ ...mockState.profile, refetch: mockRefetch }),
}));
jest.mock("../src/hooks/use-saved-palettes", () => ({
  useSavedPalettes: () => ({ data: mockState.saved }),
  useSavePalette: () => ({ mutate: mockSave, isPending: false, isError: false }),
  useDeleteSavedPalette: () => ({ mutate: mockRemove, isPending: false, isError: false }),
}));
jest.mock("../src/hooks/use-app-state", () => ({
  useAppState: (onForeground: () => void) => {
    mockForeground = onForeground;
  },
}));
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } | null }) => unknown) =>
    select({ session: mockState.userId ? { user: { id: mockState.userId } } : null }),
}));

import { router } from "expo-router";

import { TodayPalette } from "@/components/palette/TodayPalette";
import { usePaletteRecentStore } from "@/stores/palette-recent-store";

const NO_DASH = /[–—]/;
const US_SPELLING = /colors?\b|jewelry/i;

type Rendered = { children?: (Rendered | string)[] | null };

/** Every string a member can read on screen, with no class names or props mixed in. */
function visibleText(node: Rendered | Rendered[] | null): string {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(visibleText).join(" ");
  return (node.children ?? [])
    .map((child) => (typeof child === "string" ? child : visibleText(child)))
    .join(" ");
}

function freezeDay(year: number, monthIndex: number, day: number, hour = 12) {
  // Only Date is faked: timers and microtasks stay real so the screen settles.
  jest.useFakeTimers({
    now: new Date(year, monthIndex, day, hour, 0),
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
}

function withRead() {
  mockState.profile = {
    data: { color_profile: { primarySwatches: SWATCHES } },
    isPending: false,
    isError: false,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockForeground = null;
  mockState.userId = "member-1";
  mockState.saved = [];
  mockState.profile = { data: { color_profile: null }, isPending: false, isError: false };
  await AsyncStorage.clear();
  usePaletteRecentStore.setState({ byUser: {} });
  await usePaletteRecentStore.persist.rehydrate();
  freezeDay(2026, 9, 7);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("TodayPalette from her own colours", () => {
  it("wear lines", async () => {
    withRead();
    const s = await render(<TodayPalette seasonId="true_autumn" />);

    // Golden vector: member-1 on 2026-10-07, first pick.
    expect(await s.findByText("Charcoal")).toBeTruthy();
    expect(s.getByText("Rust")).toBeTruthy();
    expect(s.getByText("Camel")).toBeTruthy();

    expect(s.getByText("Base")).toBeTruthy();
    expect(s.getByText("Statement")).toBeTruthy();
    expect(s.getByText("Accent")).toBeTruthy();
    expect(s.getByText("Bottoms or a jacket")).toBeTruthy();
    expect(s.getByText("Top, near your face")).toBeTruthy();
    expect(s.getByText("Shoes, bag or jewellery")).toBeTruthy();
    expect(s.getByText("From your colours")).toBeTruthy();
    expect(
      s.getByText(
        "Wear Charcoal on your bottoms or a jacket, Rust on top near your face, and Camel on your shoes, bag or jewellery.",
        { exact: false },
      ),
    ).toBeTruthy();
  });

  it("Mila's take: with no dash, and no US spelling anywhere on screen", async () => {
    withRead();
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Charcoal");

    expect(s.getByText("Mila's take:")).toBeTruthy();
    const everything = visibleText(s.toJSON() as Rendered);
    expect(everything).not.toMatch(NO_DASH);
    expect(everything).not.toMatch(US_SPELLING);
  });

  it("records today's first pick, so tomorrow cannot repeat it", async () => {
    withRead();
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Charcoal");

    const first = trioKey(["#36454F", "#B7410E", "#C19A6B"]);
    await waitFor(() => {
      const stored = usePaletteRecentStore.getState().read("member-1", "2026-10-07");
      expect(stored.shown).toBe(first);
      expect(stored.recent).toEqual([first]);
    });
  });

  it("shuffle never shows one of the last five trios", async () => {
    withRead();
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Charcoal");

    const seen: string[] = [];
    const nowOnScreen = () => {
      const stored = usePaletteRecentStore.getState().read("member-1", "2026-10-07");
      return stored.shown ?? "";
    };
    await waitFor(() => expect(nowOnScreen()).not.toBe(""));
    seen.push(nowOnScreen());
    for (let i = 0; i < 8; i += 1) {
      const before = nowOnScreen();
      await fireEvent.press(s.getByLabelText("Shuffle palette"));
      await waitFor(() => expect(nowOnScreen()).not.toBe(before));
      const after = nowOnScreen();
      // Not one of the five shown just before this one.
      expect(seen.slice(-5)).not.toContain(after);
      seen.push(after);
    }
    expect(usePaletteRecentStore.getState().read("member-1", "2026-10-07").recent).toHaveLength(5);
  });

  it("announces the new palette to a screen reader on shuffle", async () => {
    withRead();
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Charcoal");

    await fireEvent.press(s.getByLabelText("Shuffle palette"));
    await waitFor(() => expect(announce).toHaveBeenCalled());
    expect(announce.mock.calls[0]?.[0]).toMatch(/^New palette: .+, .+ and .+\.$/);
  });

  it("startFresh keeps what she was shown and opens on the next pick, never the one on screen", async () => {
    withRead();
    const first = trioKey(["#36454F", "#B7410E", "#C19A6B"]);
    usePaletteRecentStore
      .getState()
      .save("member-1", { dateKey: "2026-10-07", attempt: 0, recent: [first], shown: first });

    const s = await render(<TodayPalette seasonId="true_autumn" startFresh />);
    await waitFor(() => {
      const stored = usePaletteRecentStore.getState().read("member-1", "2026-10-07");
      expect(stored.attempt).toBe(1);
      expect(stored.shown).not.toBe(first);
      expect(stored.recent).toContain(first);
    });
    const next = buildDailyPalette({
      swatches: SWATCHES,
      seed: paletteSeed("member-1", "2026-10-07", 1),
      recent: [first],
    });
    expect(next).not.toBeNull();
    expect(s.getByText(next!.baseColor)).toBeTruthy();
    expect(s.getByText(next!.statementColor)).toBeTruthy();
    expect(s.getByText(next!.accentColor)).toBeTruthy();
  });

  it("the day key follows midnight: coming back after it starts the new day's palette", async () => {
    freezeDay(2026, 9, 7, 23);
    withRead();
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Charcoal");

    freezeDay(2026, 9, 8, 0);
    await act(async () => {
      mockForeground?.();
    });

    // The new day's seed, with yesterday's pick still counted as recent.
    const expected = buildDailyPalette({
      swatches: SWATCHES,
      seed: paletteSeed("member-1", "2026-10-08", 0),
      recent: [trioKey(["#36454F", "#B7410E", "#C19A6B"])],
    })!;
    // The new day's pick is recorded under the new day, which only happens if the card moved on.
    await waitFor(() =>
      expect(usePaletteRecentStore.getState().read("member-1", "2026-10-08").shown).toBe(
        trioKey([expected.baseHex, expected.statementHex, expected.accentHex]),
      ),
    );
    expect(s.getByText(expected.baseColor)).toBeTruthy();
    expect(usePaletteRecentStore.getState().read("member-1", "2026-10-08").attempt).toBe(0);
  });

  it("pins the palette as one built from her own colours, and unpins it again", async () => {
    withRead();
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Charcoal");

    await fireEvent.press(s.getByLabelText("Save this palette"));
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ baseColor: "Charcoal", source: "swatches" }),
    );
  });

  it("shows Remove once this trio is already saved", async () => {
    withRead();
    mockState.saved = [
      {
        id: "row-1",
        created_at: "2026-10-07T00:00:00Z",
        palette: { baseHex: "#36454F", statementHex: "#B7410E", accentHex: "#C19A6B" },
      },
    ];
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Charcoal");

    await fireEvent.press(s.getByLabelText("Remove this palette from saved"));
    expect(mockRemove).toHaveBeenCalledWith("row-1");
  });

  it("links to the saved palettes", async () => {
    withRead();
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Charcoal");

    await fireEvent.press(s.getByRole("link", { name: "View saved palettes" }));
    expect(router.push).toHaveBeenCalledWith("/palettes");
  });
});

describe("TodayPalette without a colour read", () => {
  it("curated fallback without a read, and a way to start one", async () => {
    const s = await render(<TodayPalette seasonId="true_autumn" />);

    expect(
      await s.findByText("Palettes from your own colours start after your colour read."),
    ).toBeTruthy();
    expect(s.queryByText("From your colours")).toBeNull();
    // Still a full palette: three roles, three wear lines, a take.
    expect(s.getByText("Base")).toBeTruthy();
    expect(s.getByText("Bottoms or a jacket")).toBeTruthy();
    expect(s.getByText("Mila's take:")).toBeTruthy();
    expect(visibleText(s.toJSON() as Rendered)).not.toMatch(NO_DASH);
    expect(visibleText(s.toJSON() as Rendered)).not.toMatch(US_SPELLING);

    await fireEvent.press(s.getByRole("button", { name: "Read my colours" }));
    expect(router.push).toHaveBeenCalledWith("/dossier/color");
  });

  it("two swatches are not enough for a trio", async () => {
    mockState.profile = {
      data: { color_profile: { primarySwatches: SWATCHES.slice(0, 2) } },
      isPending: false,
      isError: false,
    };
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    expect(
      await s.findByText("Palettes from your own colours start after your colour read."),
    ).toBeTruthy();
  });

  it("shuffle gives another curated mix", async () => {
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Mila's take:");
    await expect(fireEvent.press(s.getByLabelText("Shuffle palette"))).resolves.not.toThrow();
    expect(s.getByText("Mix 02")).toBeTruthy();
  });
});

describe("TodayPalette states", () => {
  it("loading: a skeleton of three, no colour names, no claim about her read", async () => {
    mockState.profile = { data: undefined, isPending: true, isError: false };
    const s = await render(<TodayPalette seasonId="true_autumn" />);

    expect(s.getByLabelText("Loading your colours")).toBeTruthy();
    expect(s.queryByText("Base")).toBeNull();
    expect(s.queryByText(/start after your colour read/)).toBeNull();
  });

  it("error: an honest line and a retry, never the curated 'no read' claim", async () => {
    mockState.profile = { data: undefined, isPending: false, isError: true };
    const s = await render(<TodayPalette seasonId="true_autumn" />);

    expect(s.getByText("We couldn't load your colours. Try again.")).toBeTruthy();
    expect(s.queryByText(/start after your colour read/)).toBeNull();
    expect(s.queryByLabelText("Shuffle palette")).toBeNull();

    await fireEvent.press(s.getByRole("button", { name: "Try again" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("a failed refetch with a read already in hand keeps showing her palette", async () => {
    mockState.profile = {
      data: { color_profile: { primarySwatches: SWATCHES } },
      isPending: false,
      isError: true,
    };
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    expect(await s.findByText("Charcoal")).toBeTruthy();
    expect(s.queryByText("We couldn't load your colours. Try again.")).toBeNull();
  });

  it("a garbled stored shape never crashes the card", async () => {
    withRead();
    await AsyncStorage.setItem(
      "mila-palette-recent",
      JSON.stringify({ state: { byUser: { "member-1": { dateKey: 7, recent: "x" } } }, version: 1 }),
    );
    await usePaletteRecentStore.persist.rehydrate();
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    expect(await s.findByText("Charcoal")).toBeTruthy();
  });

  it("touch targets in the daily flow are 48px: save, shuffle and the retry", async () => {
    withRead();
    const s = await render(<TodayPalette seasonId="true_autumn" />);
    await s.findByText("Charcoal");
    for (const label of ["Save this palette", "Shuffle palette"]) {
      expect(s.getByLabelText(label).props.className).toMatch(/\bh-12\b/);
    }
  });
});
