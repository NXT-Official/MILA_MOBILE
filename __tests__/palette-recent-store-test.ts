import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  initialPaletteState,
  recordShown,
  usePaletteRecentStore,
} from "@/stores/palette-recent-store";

/**
 * What today's palette remembers on this device, per member: the day it was
 * last shuffled, how many shuffles, and the last five trios shown. Same rules
 * as the web's palette-recent, over the persisted zustand store pattern.
 */

const KEY = "mila-palette-recent";

beforeEach(async () => {
  await AsyncStorage.clear();
  usePaletteRecentStore.setState({ byUser: {} });
});

describe("palette recent store", () => {
  it("five keys; resets daily", () => {
    const { save, read } = usePaletteRecentStore.getState();
    save("u1", { dateKey: "2026-10-06", attempt: 4, recent: ["a", "b", "c", "d", "e", "f", "g"] });

    expect(read("u1", "2026-10-06")).toEqual({
      dateKey: "2026-10-06",
      attempt: 4,
      recent: ["c", "d", "e", "f", "g"],
    });
    // A new local day restarts the attempt count but keeps what was recent.
    expect(read("u1", "2026-10-07")).toEqual({
      dateKey: "2026-10-07",
      attempt: 0,
      recent: ["c", "d", "e", "f", "g"],
    });
  });

  it("a member with nothing stored starts from the first pick", () => {
    expect(usePaletteRecentStore.getState().read("nobody", "2026-10-07")).toEqual({
      dateKey: "2026-10-07",
      attempt: 0,
      recent: [],
    });
  });

  it("members do not share state", () => {
    const { save, read } = usePaletteRecentStore.getState();
    save("u1", { dateKey: "2026-10-07", attempt: 2, recent: ["a"] });
    expect(read("u2", "2026-10-07").attempt).toBe(0);
    expect(read("u2", "2026-10-07").recent).toEqual([]);
    expect(read("u1", "2026-10-07").attempt).toBe(2);
  });

  it("persists to storage under the member's id", async () => {
    usePaletteRecentStore
      .getState()
      .save("u1", { dateKey: "2026-10-07", attempt: 1, recent: ["x|y|z"], shown: "x|y|z" });
    await new Promise((resolve) => setImmediate(resolve));
    const raw = await AsyncStorage.getItem(KEY);
    expect(raw).toContain("u1");
    expect(raw).toContain("x|y|z");
  });

  it("never crashes on a bad persisted shape", async () => {
    const bads: unknown[] = [
      { state: { byUser: "nope" }, version: 1 },
      { state: { byUser: null }, version: 1 },
      { state: { byUser: [1, 2] }, version: 1 },
      { state: null, version: 1 },
      { state: { byUser: { u1: "x" } }, version: 1 },
      { state: { byUser: { u1: { dateKey: 5, attempt: 1, recent: [] } } }, version: 1 },
      { state: { byUser: { u1: { dateKey: "2026-10-07", attempt: -1, recent: [] } } }, version: 1 },
      { state: { byUser: { u1: { dateKey: "2026-10-07", attempt: 1.5, recent: [] } } }, version: 1 },
      { state: { byUser: { u1: { dateKey: "2026-10-07", attempt: 1, recent: [1] } } }, version: 1 },
      {
        state: { byUser: { u1: { dateKey: "2026-10-07", attempt: 1, recent: [], shown: 5 } } },
        version: 1,
      },
    ];
    for (const bad of bads) {
      await AsyncStorage.setItem(KEY, JSON.stringify(bad));
      await usePaletteRecentStore.persist.rehydrate();
      const state = usePaletteRecentStore.getState();
      expect(state.read("u1", "2026-10-07")).toEqual({
        dateKey: "2026-10-07",
        attempt: 0,
        recent: [],
      });
      expect(() => state.save("u1", { dateKey: "2026-10-07", attempt: 1, recent: [] })).not.toThrow();
    }
    await AsyncStorage.setItem(KEY, "{not json");
    await expect(usePaletteRecentStore.persist.rehydrate()).resolves.not.toThrow();
  });

  it("keeps a good member's entry when another member's entry is bad", async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        state: {
          byUser: {
            good: { dateKey: "2026-10-07", attempt: 2, recent: ["a"], shown: "a" },
            bad: { dateKey: 7 },
          },
        },
        version: 1,
      }),
    );
    await usePaletteRecentStore.persist.rehydrate();
    const { read } = usePaletteRecentStore.getState();
    expect(read("good", "2026-10-07")).toEqual({
      dateKey: "2026-10-07",
      attempt: 2,
      recent: ["a"],
      shown: "a",
    });
    expect(read("bad", "2026-10-07").attempt).toBe(0);
  });

  it("a stored shown trio survives the day it was shown and is forgotten on the next", () => {
    const { save, read } = usePaletteRecentStore.getState();
    save("u1", { dateKey: "2026-10-07", attempt: 2, recent: ["a", "b"], shown: "b" });
    expect(read("u1", "2026-10-07").shown).toBe("b");
    const next = read("u1", "2026-10-08");
    expect(next.shown).toBeUndefined();
    expect(next.recent).toEqual(["a", "b"]);
  });
});

describe("what is on screen", () => {
  it("recordShown stores today's pick in recent once, so tomorrow cannot repeat it", () => {
    const state = { dateKey: "2026-10-07", attempt: 0, recent: ["a", "b"] };
    const recorded = recordShown(state, "c");
    expect(recorded).toEqual({
      dateKey: "2026-10-07",
      attempt: 0,
      recent: ["a", "b", "c"],
      shown: "c",
    });
    expect(recordShown(recorded, "c")).toBe(recorded);
    const full = recordShown({ dateKey: "d", attempt: 0, recent: ["a", "b", "c", "d", "e"] }, "f");
    expect(full.recent).toEqual(["b", "c", "d", "e", "f"]);
  });

  it("startFresh keeps recent, moves to the next attempt and excludes the trio on screen", () => {
    const stored = { dateKey: "2026-10-07", attempt: 2, recent: ["a", "b"], shown: "b" };
    expect(initialPaletteState(stored, false)).toBe(stored);
    expect(initialPaletteState(stored, true)).toEqual({
      dateKey: "2026-10-07",
      attempt: 3,
      recent: ["a", "b"],
    });
    expect(
      initialPaletteState({ dateKey: "2026-10-07", attempt: 0, recent: ["x"], shown: "y" }, true),
    ).toEqual({ dateKey: "2026-10-07", attempt: 1, recent: ["x", "y"] });
    expect(initialPaletteState({ dateKey: "2026-10-07", attempt: 0, recent: [] }, true)).toEqual({
      dateKey: "2026-10-07",
      attempt: 1,
      recent: [],
    });
  });
});
