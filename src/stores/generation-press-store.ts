import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { persistStorage } from "./persist-storage";

/**
 * Her own paid presses on Home that have not been answered yet (R7): the
 * idempotency key each one sent, and when. Client-minted values, not server
 * data and not a secret (the server stores the key on its job row; this is only
 * which keys THIS phone sent), so AsyncStorage through the usual persist helper.
 *
 * Kept across a restart for two reasons:
 * - her job rows can be told apart from ones made on another device, so her own
 *   unanswered look always lands and gets the free style sheet it would have;
 * - after a dropped connection the next press resends the SAME key, so the
 *   server replays or follows the job she already paid for instead of charging
 *   again.
 *
 * A key is forgotten on a real server answer, or once her job row has settled.
 */
export type PressKind = "look" | "style_sheet" | "photo_preview";

export type PressEntry = {
  id: string;
  /** Device time of the press (ms). */
  at: number;
  /** For a visual: the look it was asked for (headline and description). Null for a look. */
  lookKey: string | null;
};

type Presses = Record<string, Partial<Record<PressKind, PressEntry[]>>>;

/**
 * Longer than a job can run and still be reaped (300 s deadline + 30 s grace)
 * with room to reopen the app, short enough that an old key is never resent
 * for a new day's press.
 */
export const PRESS_TTL_MS = 30 * 60_000;

type PressState = {
  presses: Presses;
  /** False until the persisted presses have been read back. */
  hydrated: boolean;
  remember: (userId: string, kind: PressKind, entry: PressEntry) => void;
  settle: (userId: string, kind: PressKind, id: string) => void;
};

function isEntry(value: unknown): value is PressEntry {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.at === "number" &&
    (entry.lookKey === null || typeof entry.lookKey === "string")
  );
}

function live(entries: unknown, now: number): PressEntry[] {
  return Array.isArray(entries)
    ? entries.filter((entry): entry is PressEntry => isEntry(entry) && now - entry.at < PRESS_TTL_MS)
    : [];
}

/** Every member's presses with the expired ones (and anything unreadable) dropped. */
function pruned(presses: Presses, now: number): Presses {
  const next: Presses = {};
  for (const [userId, kinds] of Object.entries(presses ?? {})) {
    const kept: Partial<Record<PressKind, PressEntry[]>> = {};
    for (const kind of ["look", "style_sheet", "photo_preview"] as const) {
      const entries = live(kinds?.[kind], now);
      if (entries.length > 0) kept[kind] = entries;
    }
    if (Object.keys(kept).length > 0) next[userId] = kept;
  }
  return next;
}

export const useGenerationPressStore = create<PressState>()(
  persist(
    (set) => ({
      presses: {},
      hydrated: false,
      remember: (userId, kind, entry) =>
        set((state) => {
          const presses = pruned(state.presses, Date.now());
          const entries = (presses[userId]?.[kind] ?? []).filter((e) => e.id !== entry.id);
          return {
            presses: { ...presses, [userId]: { ...presses[userId], [kind]: [...entries, entry] } },
          };
        }),
      settle: (userId, kind, id) =>
        set((state) => {
          const entries = state.presses[userId]?.[kind];
          if (!entries?.some((entry) => entry.id === id)) return state;
          return {
            presses: {
              ...state.presses,
              [userId]: { ...state.presses[userId], [kind]: entries.filter((e) => e.id !== id) },
            },
          };
        }),
    }),
    {
      name: "mila-generation-presses",
      storage: createJSONStorage(persistStorage),
      partialize: (state) => ({ presses: state.presses }),
      onRehydrateStorage: () => (state) => {
        // Runs on success and on failure: a read error must not hold recovery
        // back forever, it only means no press of hers is remembered.
        useGenerationPressStore.setState({
          hydrated: true,
          presses: pruned(state?.presses ?? {}, Date.now()),
        });
      },
    },
  ),
);

/** Her unanswered presses of one kind, oldest first. `now` is passed in (no clock in render). */
export function pendingPresses(
  state: Pick<PressState, "presses">,
  userId: string | null | undefined,
  kind: PressKind,
  now: number,
): PressEntry[] {
  if (!userId) return [];
  return live(state.presses[userId]?.[kind], now);
}

/**
 * The unanswered press to resend instead of minting a new key: the newest one
 * asked for the same look (or, for a look, the newest one). Resending a key the
 * server already has replays or follows that job: never a second charge.
 */
export function retryablePress(entries: PressEntry[], lookKey: string | null): PressEntry | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].lookKey === lookKey) return entries[index];
  }
  return null;
}
