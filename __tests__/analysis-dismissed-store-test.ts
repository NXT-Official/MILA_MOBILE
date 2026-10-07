import AsyncStorage from "@react-native-async-storage/async-storage";

import { DISMISSED_LIMIT, useAnalysisDismissedStore } from "@/stores/analysis-dismissed-store";

/**
 * Which finished reads she has already dismissed, so a result is offered once.
 * UI state only, not server data: the last 20 job ids.
 */

beforeEach(async () => {
  await AsyncStorage.clear();
  useAnalysisDismissedStore.setState({ ids: [] });
});

it("remembers a dismissed id once", () => {
  const { dismiss } = useAnalysisDismissedStore.getState();
  dismiss("job-1");
  dismiss("job-1");
  expect(useAnalysisDismissedStore.getState().ids).toEqual(["job-1"]);
});

it("keeps only the last 20, dropping the oldest", () => {
  const { dismiss } = useAnalysisDismissedStore.getState();
  for (let i = 0; i < DISMISSED_LIMIT + 3; i += 1) dismiss(`job-${i}`);

  const { ids } = useAnalysisDismissedStore.getState();
  expect(DISMISSED_LIMIT).toBe(20);
  expect(ids).toHaveLength(20);
  expect(ids[0]).toBe("job-3");
  expect(ids[19]).toBe(`job-${DISMISSED_LIMIT + 2}`);
});

it("persists the ids to storage", async () => {
  useAnalysisDismissedStore.getState().dismiss("job-9");
  await new Promise((resolve) => setImmediate(resolve));
  const raw = await AsyncStorage.getItem("mila-analysis-dismissed");
  expect(raw).toContain("job-9");
});
