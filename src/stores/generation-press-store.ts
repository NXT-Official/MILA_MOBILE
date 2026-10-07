import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { persistStorage } from "./persist-storage";

/**
 * Her own paid presses on Home that have not been answered yet (R7): the
 * idempotency key each one sent, and when. Client-minted values, not server
 * data and not a secret (the server stores the key on its job row; this is only
 * which keys THIS phone sent), so AsyncStorage through the usual persist helper.
 * A visual's press carries a short fingerprint of its look, never the look's
 * words (§6: no server answer is stored here).
 *
 * Kept across a restart for two reasons:
 * - her job rows can be told apart from ones made on another device, so her own
 *   unanswered look always lands and gets the free style sheet it would have;
 * - after a dropped connection the next press resends the SAME key, so the
 *   server replays or follows the job she already paid for instead of charging
 *   again.
 *
 * A key is forgotten on a real server answer, once her job row has ended and
 * been handled, or when it is older than the 12 hour recovery window.
 */
export type PressKind = "look" | "style_sheet" | "photo_preview";

/** What a look press asked for, so a replay of it is shown and saved as what it was. */
export type PressContext = { vibe: string; weather: string };

export type PressEntry = {
  id: string;
  /** Device time the key was last sent (ms); refreshed on every resend. */
  at: number;
  /** For a visual: the fingerprint of the look it was asked for. Null for a look. */
  fingerprint: string | null;
  /** For a look: the vibe and weather it was asked with. */
  context?: PressContext | null;
};

type Presses = Record<string, Partial<Record<PressKind, PressEntry[]>>>;

/**
 * An unanswered press counts as hers, and is resent, for the same 12 hours a
 * finished look can come back. It is measured from when the key was LAST sent.
 */
export const PRESS_TTL_MS = 12 * 60 * 60_000;
/**
 * Past the window a look press is kept a while longer, so a new press can first
 * ask the server what became of it (`expiredPress`) instead of minting over it.
 */
export const PRESS_RETAIN_MS = 2 * PRESS_TTL_MS;

type PressState = {
  presses: Presses;
  /** False until the persisted presses have been read back. */
  hydrated: boolean;
  /** Adds a press, or refreshes the one with the same key. */
  remember: (userId: string, kind: PressKind, entry: PressEntry) => void;
  settle: (userId: string, kind: PressKind, id: string) => void;
};

const KINDS = ["look", "style_sheet", "photo_preview"] as const;

function isContext(value: unknown): value is PressContext {
  if (value === null || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  return typeof context.vibe === "string" && typeof context.weather === "string";
}

function isEntry(value: unknown): value is PressEntry {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.at === "number" &&
    (entry.fingerprint === null || typeof entry.fingerprint === "string") &&
    (entry.context === undefined || entry.context === null || isContext(entry.context))
  );
}

function entriesOf(entries: unknown, keep: (age: number) => boolean, now: number): PressEntry[] {
  return Array.isArray(entries)
    ? entries.filter((entry): entry is PressEntry => isEntry(entry) && keep(now - entry.at))
    : [];
}

/** Every member's presses with the ones past retention (and anything unreadable) dropped. */
function pruned(presses: Presses, now: number): Presses {
  const next: Presses = {};
  for (const [userId, kinds] of Object.entries(presses ?? {})) {
    const kept: Partial<Record<PressKind, PressEntry[]>> = {};
    for (const kind of KINDS) {
      const entries = entriesOf(kinds?.[kind], (age) => age < PRESS_RETAIN_MS, now);
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
        // back forever, it only means no press of hers is remembered. Writing
        // the pruned presses back also drops entries of an older shape.
        useGenerationPressStore.setState({
          hydrated: true,
          presses: pruned(state?.presses ?? {}, Date.now()),
        });
      },
    },
  ),
);

/** Her unanswered presses of one kind inside the window, oldest first. `now` is passed in (no clock in render). */
export function pendingPresses(
  state: Pick<PressState, "presses">,
  userId: string | null | undefined,
  kind: PressKind,
  now: number,
): PressEntry[] {
  if (!userId) return [];
  return entriesOf(state.presses[userId]?.[kind], (age) => age < PRESS_TTL_MS, now);
}

/** Her newest press of one kind that is past the window but still retained, or null. */
export function expiredPress(
  state: Pick<PressState, "presses">,
  userId: string | null | undefined,
  kind: PressKind,
  now: number,
): PressEntry | null {
  if (!userId) return null;
  const expired = entriesOf(
    state.presses[userId]?.[kind],
    (age) => age >= PRESS_TTL_MS && age < PRESS_RETAIN_MS,
    now,
  );
  return expired.at(-1) ?? null;
}

/**
 * The unanswered press to resend instead of minting a new key: the newest one
 * asked for the same look (or, for a look, the newest one). Resending a key the
 * server already has replays or follows that job: never a second charge.
 */
export function retryablePress(entries: PressEntry[], fingerprint: string | null): PressEntry | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index].fingerprint === fingerprint) return entries[index];
  }
  return null;
}
