import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  expiredPress,
  PRESS_RETAIN_MS,
  PRESS_TTL_MS,
  pendingPresses,
  retryablePress,
  useGenerationPressStore,
} from "@/stores/generation-press-store";

/**
 * Her own paid presses that have not been answered yet (R7), kept across a
 * restart so the app can tell her own job rows from ones made elsewhere, and
 * resend the same key after a dropped connection instead of paying twice.
 * Not a secret and not server data: the press keys she minted, when, and a
 * fingerprint of the look a visual was asked for (never the look's words).
 */

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

beforeEach(async () => {
  await AsyncStorage.clear();
  useGenerationPressStore.setState({ presses: {} });
});

it("remembers a press per member and kind, and forgets only the one that was answered", () => {
  const { remember, settle } = useGenerationPressStore.getState();
  remember("member", "look", { id: "look-1", at: NOW, fingerprint: null });
  remember("member", "look", { id: "look-2", at: NOW + 1, fingerprint: null });
  remember("member", "style_sheet", { id: "sheet-1", at: NOW, fingerprint: "3f2a9c01b4d7e5" });
  remember("someone-else", "look", { id: "other-1", at: NOW, fingerprint: null });

  settle("member", "look", "look-1");

  const state = useGenerationPressStore.getState();
  expect(pendingPresses(state, "member", "look", NOW).map((p) => p.id)).toEqual(["look-2"]);
  expect(pendingPresses(state, "member", "style_sheet", NOW).map((p) => p.id)).toEqual(["sheet-1"]);
  expect(pendingPresses(state, "someone-else", "look", NOW).map((p) => p.id)).toEqual(["other-1"]);
  expect(pendingPresses(state, "nobody", "look", NOW)).toEqual([]);
});

it("keeps an unanswered press for the whole 12 hour recovery window, not a 30 minute timer", () => {
  expect(PRESS_TTL_MS).toBe(12 * HOUR);
  const { remember } = useGenerationPressStore.getState();
  remember("member", "look", { id: "look-1", at: NOW - 31 * 60_000, fingerprint: null });
  remember("member", "look", { id: "old", at: NOW - PRESS_TTL_MS - 1, fingerprint: null });

  const state = useGenerationPressStore.getState();
  expect(pendingPresses(state, "member", "look", NOW).map((p) => p.id)).toEqual(["look-1"]);
});

it("refreshes a press's time when its key is sent again", () => {
  const { remember } = useGenerationPressStore.getState();
  remember("member", "look", { id: "look-1", at: NOW - 11 * HOUR, fingerprint: null, context: { vibe: "Brunch", weather: "Mild (in Manila)" } });
  remember("member", "look", { id: "look-1", at: NOW, fingerprint: null, context: { vibe: "Brunch", weather: "Mild (in Manila)" } });

  const state = useGenerationPressStore.getState();
  expect(state.presses.member?.look).toHaveLength(1);
  // Two hours later it is still well inside the window: 2 h since it was last sent.
  expect(pendingPresses(state, "member", "look", NOW + 2 * HOUR).map((p) => p.id)).toEqual(["look-1"]);
});

it("hands back an expired press so its row can be asked before a new key is minted", () => {
  const { remember } = useGenerationPressStore.getState();
  remember("member", "look", { id: "expired", at: NOW - 13 * HOUR, fingerprint: null });

  const state = useGenerationPressStore.getState();
  expect(pendingPresses(state, "member", "look", NOW)).toEqual([]);
  expect(expiredPress(state, "member", "look", NOW)?.id).toBe("expired");
  expect(expiredPress(state, "member", "look", NOW + PRESS_RETAIN_MS)).toBeNull();
  expect(expiredPress(state, "member", "style_sheet", NOW)).toBeNull();
});

it("offers the same key again only for the same look", () => {
  const entries = [
    { id: "sheet-a", at: NOW, fingerprint: "aaaaaaaaaaaaaa" },
    { id: "sheet-b", at: NOW + 1, fingerprint: "bbbbbbbbbbbbbb" },
  ];
  expect(retryablePress(entries, "aaaaaaaaaaaaaa")?.id).toBe("sheet-a");
  expect(retryablePress(entries, "cccccccccccccc")).toBeNull();
  expect(retryablePress([{ id: "look-1", at: NOW, fingerprint: null }], null)?.id).toBe("look-1");
  expect(retryablePress([], null)).toBeNull();
});

it("survives a restart: written to storage and read back", async () => {
  useGenerationPressStore.getState().remember("member", "look", { id: "look-1", at: Date.now(), fingerprint: null });
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

it("drops presses past the retention bound, and old entries that held a look's words, when it is read back", async () => {
  await AsyncStorage.setItem(
    "mila-generation-presses",
    JSON.stringify({
      state: {
        presses: {
          member: {
            look: [
              { id: "too-old", at: Date.now() - PRESS_RETAIN_MS - 60_000, fingerprint: null },
              { id: "kept", at: Date.now() - 1_000, fingerprint: null },
            ],
            // The round 1 shape stored the look's headline and description.
            style_sheet: [{ id: "words", at: Date.now(), lookKey: "Linen and light\nA light layer." }],
          },
        },
      },
      version: 0,
    }),
  );

  await useGenerationPressStore.persist.rehydrate();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(useGenerationPressStore.getState().presses.member?.look?.map((p) => p.id)).toEqual(["kept"]);
  expect(useGenerationPressStore.getState().presses.member?.style_sheet).toBeUndefined();
  expect(await AsyncStorage.getItem("mila-generation-presses")).not.toContain("Linen");
});
