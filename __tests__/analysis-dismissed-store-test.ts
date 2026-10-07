import AsyncStorage from "@react-native-async-storage/async-storage";

import { ANALYSIS_DISMISSED_LIMIT } from "@/lib/analysis-job-offer";
import { useAnalysisDismissedStore } from "@/stores/analysis-dismissed-store";

/**
 * Which finished reads she has already dismissed, so a result is offered once.
 * UI state only, not server data: the last 20 job ids PER MEMBER, so one
 * member's dismissals never evict or hide another's on a shared phone.
 */

beforeEach(async () => {
  await AsyncStorage.clear();
  useAnalysisDismissedStore.setState({ byUser: {} });
});

it("remembers a dismissed id once", () => {
  const { dismiss, isDismissed } = useAnalysisDismissedStore.getState();
  dismiss("a", "job-1");
  dismiss("a", "job-1");
  expect(useAnalysisDismissedStore.getState().byUser).toEqual({ a: ["job-1"] });
  expect(isDismissed("a", "job-1")).toBe(true);
  expect(isDismissed("a", "job-2")).toBe(false);
});

it("keeps only the last 20 per member, dropping the oldest", () => {
  const { dismiss } = useAnalysisDismissedStore.getState();
  for (let i = 0; i < ANALYSIS_DISMISSED_LIMIT + 3; i += 1) dismiss("a", `job-${i}`);

  const ids = useAnalysisDismissedStore.getState().byUser.a ?? [];
  expect(ids).toHaveLength(20);
  expect(ids[0]).toBe("job-3");
});

it("B's dismissals never evict A's, and A's never apply to B", () => {
  const { dismiss } = useAnalysisDismissedStore.getState();
  dismiss("a", "a-job");
  for (let i = 0; i < ANALYSIS_DISMISSED_LIMIT + 5; i += 1) dismiss("b", `b-job-${i}`);

  const { isDismissed } = useAnalysisDismissedStore.getState();
  expect(isDismissed("a", "a-job")).toBe(true);
  expect(isDismissed("b", "a-job")).toBe(false);
  expect(isDismissed("a", "b-job-24")).toBe(false);
});

it("persists the ids to storage", async () => {
  useAnalysisDismissedStore.getState().dismiss("a", "job-9");
  await new Promise((resolve) => setImmediate(resolve));
  const raw = await AsyncStorage.getItem("mila-analysis-dismissed");
  expect(raw).toContain("job-9");
});

it("drops the old flat shape without crashing (costs one re-offer)", async () => {
  await AsyncStorage.setItem(
    "mila-analysis-dismissed",
    JSON.stringify({ state: { ids: ["old-1", "old-2"] }, version: 0 }),
  );
  await useAnalysisDismissedStore.persist.rehydrate();

  const state = useAnalysisDismissedStore.getState();
  expect(state.byUser).toEqual({});
  expect(state.isDismissed("a", "old-1")).toBe(false);
  expect(() => state.dismiss("a", "new")).not.toThrow();
});

it("survives a garbled persisted value", async () => {
  await AsyncStorage.setItem(
    "mila-analysis-dismissed",
    JSON.stringify({ state: { byUser: { a: "nope", b: [1, "ok"] } }, version: 1 }),
  );
  await useAnalysisDismissedStore.persist.rehydrate();
  const { isDismissed } = useAnalysisDismissedStore.getState();
  expect(isDismissed("a", "nope")).toBe(false);
  expect(isDismissed("b", "ok")).toBe(true);
});
