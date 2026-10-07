import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { RECENT_TRIOS, pushRecent } from "@/lib/color-analysis/daily-palette";

import { persistStorage } from "./persist-storage";

/**
 * What today's palette remembers on this device, per member: the day it was
 * last shuffled, how many shuffles that day, and the last five trios shown.
 * UI state, not server data. Keyed by user id, so on a shared phone one
 * member's shuffles never decide another's pick. Nothing here is required: a
 * bad or missing entry just means today's palette starts from the first pick.
 *
 * Mirrors the web's `palette-recent`, including its ruling that a new day keeps
 * `recent` and restarts the attempt count.
 */
export type PaletteState = {
  dateKey: string;
  attempt: number;
  recent: string[];
  /** The trio key on screen today, once it has been recorded in `recent`. */
  shown?: string;
};

type PaletteRecentState = {
  byUser: Record<string, PaletteState>;
  /** The saved state for `todayKey`; a new day keeps the recent trios and restarts the attempt count. */
  read: (userId: string, todayKey: string) => PaletteState;
  save: (userId: string, state: PaletteState) => void;
};

function fresh(dateKey: string, recent: string[] = []): PaletteState {
  return { dateKey, attempt: 0, recent };
}

/** The entry if it is the exact stored shape, otherwise null. Never throws. */
function validEntry(value: unknown): PaletteState | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { dateKey, attempt, recent, shown } = value as Record<string, unknown>;
  if (
    typeof dateKey !== "string" ||
    typeof attempt !== "number" ||
    !Number.isInteger(attempt) ||
    attempt < 0 ||
    !Array.isArray(recent) ||
    !recent.every((key): key is string => typeof key === "string") ||
    (shown !== undefined && typeof shown !== "string")
  ) {
    return null;
  }
  const kept = recent.slice(-RECENT_TRIOS);
  return shown === undefined ? { dateKey, attempt, recent: kept } : { dateKey, attempt, recent: kept, shown };
}

/** Only well-formed entries under string keys survive; anything else is dropped, never thrown on. */
function sanitized(raw: unknown): Record<string, PaletteState> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const byUser: Record<string, PaletteState> = {};
  for (const [userId, entry] of Object.entries(raw)) {
    const valid = validEntry(entry);
    if (valid) byUser[userId] = valid;
  }
  return byUser;
}

/**
 * Records the trio now on screen as the newest recent one (once), so a reload
 * shows it again and tomorrow's pick cannot repeat it.
 */
export function recordShown(state: PaletteState, key: string): PaletteState {
  if (state.shown === key) return state;
  return { ...state, recent: pushRecent(state.recent, key, RECENT_TRIOS), shown: key };
}

/**
 * The state the card opens on. `startFresh` (a check-in just changed her) keeps
 * `recent`, moves to the next attempt and counts the trio on screen as recent,
 * so she is handed a NEW pick, never the one she had.
 */
export function initialPaletteState(stored: PaletteState, startFresh: boolean): PaletteState {
  if (!startFresh) return stored;
  return {
    dateKey: stored.dateKey,
    attempt: stored.attempt + 1,
    recent: stored.shown ? pushRecent(stored.recent, stored.shown, RECENT_TRIOS) : stored.recent,
  };
}

export const usePaletteRecentStore = create<PaletteRecentState>()(
  persist(
    (set, get) => ({
      byUser: {},
      read: (userId, todayKey) => {
        const stored = validEntry(get().byUser[userId]);
        if (!stored) return fresh(todayKey);
        return stored.dateKey === todayKey ? stored : fresh(todayKey, stored.recent);
      },
      save: (userId, state) =>
        set((current) => ({
          byUser: {
            ...current.byUser,
            [userId]: { ...state, recent: state.recent.slice(-RECENT_TRIOS) },
          },
        })),
    }),
    {
      name: "mila-palette-recent",
      version: 1,
      storage: createJSONStorage(persistStorage),
      partialize: (state) => ({ byUser: state.byUser }),
      // No earlier shape exists; anything unrecognised costs one first pick.
      migrate: () => ({ byUser: {} }),
      merge: (persisted, current) => ({
        ...current,
        byUser: sanitized((persisted as { byUser?: unknown } | null)?.byUser),
      }),
    },
  ),
);
