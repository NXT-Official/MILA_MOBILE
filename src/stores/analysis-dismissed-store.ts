import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { rememberDismissed } from "@/lib/analysis-job-offer";

import { persistStorage } from "./persist-storage";

/**
 * The finished reads she has already dismissed, so a colour read, check-in or
 * body scan result is offered once. UI state, not server data: the newest 20
 * job ids per member (the shared `rememberDismissed` cap), so on a shared phone
 * one member's dismissals never evict or hide another's.
 */
type DismissedState = {
  byUser: Record<string, string[]>;
  dismiss: (userId: string, id: string) => void;
  isDismissed: (userId: string, id: string) => boolean;
};

/** Only string ids under string keys survive; anything else is dropped, never thrown on. */
function sanitized(raw: unknown): Record<string, string[]> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const byUser: Record<string, string[]> = {};
  for (const [userId, ids] of Object.entries(raw)) {
    if (Array.isArray(ids)) byUser[userId] = ids.filter((id): id is string => typeof id === "string");
  }
  return byUser;
}

export const useAnalysisDismissedStore = create<DismissedState>()(
  persist(
    (set, get) => ({
      byUser: {},
      dismiss: (userId, id) =>
        set((state) => {
          const current = state.byUser[userId] ?? [];
          if (current.includes(id)) return state;
          return { byUser: { ...state.byUser, [userId]: rememberDismissed(current, id) } };
        }),
      isDismissed: (userId, id) => get().byUser[userId]?.includes(id) ?? false,
    }),
    {
      name: "mila-analysis-dismissed",
      version: 1,
      storage: createJSONStorage(persistStorage),
      partialize: (state) => ({ byUser: state.byUser }),
      // Version 0 was a flat `ids` list for whoever was signed in. Its ids cannot
      // be attributed to a member, so they are dropped: the cost is one re-offer.
      migrate: () => ({ byUser: {} }),
      merge: (persisted, current) => ({
        ...current,
        byUser: sanitized((persisted as { byUser?: unknown } | null)?.byUser),
      }),
    },
  ),
);
