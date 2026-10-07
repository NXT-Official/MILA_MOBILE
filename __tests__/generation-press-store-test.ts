import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  PRESS_TTL_MS,
  pendingPresses,
  retryablePress,
  useGenerationPressStore,
} from "@/stores/generation-press-store";

/**
 * Her own paid presses that have not been answered yet (R7), kept across a
 * restart so the app can tell her own job rows from ones made elsewhere, and
 * resend the same key after a dropped connection instead of paying twice.
 * Not a secret and not server data: the press keys she minted, and when.
 */

const NOW = 1_800_000_000_000;

beforeEach(async () => {
  await AsyncStorage.clear();
  useGenerationPressStore.setState({ presses: {} });
});

it("remembers a press per member and kind, and forgets only the one that was answered", () => {
  const { remember, settle } = useGenerationPressStore.getState();
  remember("member", "look", { id: "look-1", at: NOW, lookKey: null });
  remember("member", "look", { id: "look-2", at: NOW + 1, lookKey: null });
  remember("member", "style_sheet", { id: "sheet-1", at: NOW, lookKey: "Linen" });
  remember("someone-else", "look", { id: "other-1", at: NOW, lookKey: null });

  settle("member", "look", "look-1");

  const state = useGenerationPressStore.getState();
  expect(pendingPresses(state, "member", "look", NOW).map((p) => p.id)).toEqual(["look-2"]);
  expect(pendingPresses(state, "member", "style_sheet", NOW).map((p) => p.id)).toEqual(["sheet-1"]);
  expect(pendingPresses(state, "someone-else", "look", NOW).map((p) => p.id)).toEqual(["other-1"]);
  expect(pendingPresses(state, "nobody", "look", NOW)).toEqual([]);
});

it("does not count a press older than a job could still be running and recovered", () => {
  const { remember } = useGenerationPressStore.getState();
  remember("member", "look", { id: "old", at: NOW - PRESS_TTL_MS - 1, lookKey: null });
  remember("member", "look", { id: "fresh", at: NOW - 1_000, lookKey: null });

  const state = useGenerationPressStore.getState();
  expect(pendingPresses(state, "member", "look", NOW).map((p) => p.id)).toEqual(["fresh"]);
});

it("offers the same key again only for the same look", () => {
  const entries = [
    { id: "sheet-a", at: NOW, lookKey: "Linen and light" },
    { id: "sheet-b", at: NOW + 1, lookKey: "Rain-ready layers" },
  ];
  expect(retryablePress(entries, "Linen and light")?.id).toBe("sheet-a");
  expect(retryablePress(entries, "Something new")).toBeNull();
  expect(retryablePress([{ id: "look-1", at: NOW, lookKey: null }], null)?.id).toBe("look-1");
  expect(retryablePress([], null)).toBeNull();
});

it("survives a restart: written to storage and read back", async () => {
  useGenerationPressStore.getState().remember("member", "look", { id: "look-1", at: Date.now(), lookKey: null });
  // Persist writes asynchronously.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const written = await AsyncStorage.getItem("mila-generation-presses");
  expect(written).toContain("look-1");

  // A fresh process: memory is empty (clearing it writes too, so the stored
  // value is put back as the restart would find it), then the store reads back.
  useGenerationPressStore.setState({ presses: {}, hydrated: false });
  await AsyncStorage.setItem("mila-generation-presses", written as string);
  await useGenerationPressStore.persist.rehydrate();

  const state = useGenerationPressStore.getState();
  expect(state.hydrated).toBe(true);
  expect(pendingPresses(state, "member", "look", Date.now()).map((p) => p.id)).toEqual(["look-1"]);
});

it("drops expired presses when it is read back", async () => {
  await AsyncStorage.setItem(
    "mila-generation-presses",
    JSON.stringify({
      state: {
        presses: {
          member: {
            look: [
              { id: "expired", at: Date.now() - PRESS_TTL_MS - 60_000, lookKey: null },
              { id: "kept", at: Date.now() - 1_000, lookKey: null },
            ],
          },
        },
      },
      version: 0,
    }),
  );

  await useGenerationPressStore.persist.rehydrate();

  expect(useGenerationPressStore.getState().presses.member?.look?.map((p) => p.id)).toEqual(["kept"]);
});
