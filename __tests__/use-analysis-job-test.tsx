import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { AnalysisJob } from "@/services/supabase/analysis-jobs";

/**
 * Her latest colour read, check-in or body scan job. Real hook over a real
 * query client; the service is the stub.
 *
 * - While the job runs the row is read again every 3 s; polling stops after.
 * - Coming back from the background reads it again.
 * - A finished job is offered once: dismissing it hides it for good.
 * - A missing migration reads as unavailable.
 */
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) =>
    select({ session: { user: { id: "member" } } }),
}));
jest.mock("../src/services/supabase/analysis-jobs", () => ({
  fetchLatestAnalysisJob: jest.fn(),
}));

import { useAnalysisJob } from "@/hooks/use-analysis-job";
import { fetchLatestAnalysisJob } from "@/services/supabase/analysis-jobs";
import { useAnalysisDismissedStore } from "@/stores/analysis-dismissed-store";

const fetchJob = jest.mocked(fetchLatestAnalysisJob);

let appStateListener: ((state: AppStateStatus) => void) | null = null;
let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function job(overrides: Partial<AnalysisJob>): AnalysisJob {
  return {
    id: "job-1",
    kind: "check_in",
    client_request_id: "request-1",
    status: "running",
    credit_state: "charged",
    result: null,
    error_code: null,
    deadline_at: new Date(Date.now() + 240_000).toISOString(),
    created_at: new Date(Date.now() - 5_000).toISOString(),
    completed_at: null,
    ...overrides,
  };
}

let row: AnalysisJob | null = null;

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  row = null;
  useAnalysisDismissedStore.setState({ ids: [] });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  fetchJob.mockImplementation(async () => ({ status: "ok", job: row }));
  appStateListener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("reads her latest job of the kind", async () => {
  row = job({ status: "running" });
  const { result } = await renderHook(() => useAnalysisJob("check_in"), { wrapper });
  await advance(0);

  expect(fetchJob).toHaveBeenCalledWith("member", "check_in");
  expect(result.current.available).toBe(true);
  expect(result.current.running).toBe(true);
  expect(result.current.job?.id).toBe("job-1");
});

it("polls every 3 s while running, and stops once it has settled", async () => {
  row = job({});
  await renderHook(() => useAnalysisJob("check_in"), { wrapper });
  await advance(0);
  expect(fetchJob).toHaveBeenCalledTimes(1);

  await advance(3_000);
  expect(fetchJob).toHaveBeenCalledTimes(2);

  row = job({ status: "succeeded", completed_at: new Date().toISOString() });
  await advance(3_000);
  expect(fetchJob).toHaveBeenCalledTimes(3);

  await advance(15_000);
  expect(fetchJob).toHaveBeenCalledTimes(3);
});

it("refetches when the app returns to the foreground", async () => {
  row = job({ status: "succeeded", completed_at: new Date().toISOString() });
  await renderHook(() => useAnalysisJob("check_in"), { wrapper });
  await advance(0);
  expect(fetchJob).toHaveBeenCalledTimes(1);

  await act(async () => {
    appStateListener?.("background");
    appStateListener?.("active");
  });
  await advance(0);

  expect(fetchJob).toHaveBeenCalledTimes(2);
});

it("offers a ready job once", async () => {
  row = job({ status: "succeeded", result: { read: {} }, completed_at: new Date().toISOString() });
  const { result } = await renderHook(() => useAnalysisJob("check_in"), { wrapper });
  await advance(0);

  expect(result.current.ready?.id).toBe("job-1");

  await act(async () => {
    result.current.dismiss("job-1");
  });

  expect(result.current.ready).toBeNull();
  expect(useAnalysisDismissedStore.getState().ids).toEqual(["job-1"]);
});

it("does not offer a job finished more than 12 hours ago", async () => {
  row = job({
    status: "succeeded",
    completed_at: new Date(Date.now() - 13 * 3_600_000).toISOString(),
  });
  const { result } = await renderHook(() => useAnalysisJob("check_in"), { wrapper });
  await advance(0);
  expect(result.current.ready).toBeNull();
});

it("reads as unavailable while the migration is missing, and never polls", async () => {
  fetchJob.mockResolvedValue({ status: "unavailable" });
  const { result } = await renderHook(() => useAnalysisJob("check_in"), { wrapper });
  await advance(30_000);

  expect(result.current.available).toBe(false);
  expect(result.current.job).toBeNull();
  expect(fetchJob).toHaveBeenCalledTimes(1);
});

it("says what the job means through the shared offer rule", async () => {
  row = job({ status: "failed", error_code: "check_in_failed", completed_at: new Date().toISOString() });
  const { result } = await renderHook(() => useAnalysisJob("check_in"), { wrapper });
  await advance(0);
  expect(result.current.offer).toBe("failed");
  expect(result.current.ready).toBeNull();
});

it("never offers a delivered-but-unstored read as a failure", async () => {
  row = job({
    status: "failed",
    error_code: "persist_failed_delivered",
    completed_at: new Date().toISOString(),
  });
  const { result } = await renderHook(() => useAnalysisJob("check_in"), { wrapper });
  await advance(0);
  expect(result.current.offer).toBeNull();
});

it("does not re-offer a check-in she has already confirmed", async () => {
  row = job({ status: "succeeded", completed_at: "2026-10-07T08:00:00Z", result: { read: {} } });
  const { result } = await renderHook(() => useAnalysisJob("check_in", { appliedAt: "2026-10-07T09:00:00Z" }), {
    wrapper,
  });
  await advance(0);
  expect(result.current.ready).toBeNull();
});
