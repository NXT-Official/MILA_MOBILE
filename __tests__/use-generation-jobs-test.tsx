import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { GenerationJob, GenerationJobKind } from "@/services/supabase/generation-jobs";

/**
 * Her latest generation jobs, as Home reads them. Real hook over a real query
 * client; the service is the stub, so a test decides what each read answers.
 *
 * - While a job runs the rows are read again every 3 s, and the polling stops
 *   once nothing is running.
 * - Coming back from the background reads them again: that is the moment a
 *   result finished while she was away.
 * - A missing migration reads as unavailable, so Home keeps today's behaviour.
 */
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) =>
    select({ session: { user: { id: "member" } } }),
}));
jest.mock("../src/services/supabase/generation-jobs", () => ({
  fetchLatestGenerationJob: jest.fn(),
  fetchGenerationImage: jest.fn(),
}));

import {
  useGenerationImage,
  useGenerationJobs,
} from "@/features/dashboard/hooks/use-generation-jobs";
import { fetchGenerationImage, fetchLatestGenerationJob } from "@/services/supabase/generation-jobs";

const fetchJob = jest.mocked(fetchLatestGenerationJob);
const fetchImage = jest.mocked(fetchGenerationImage);

let appStateListener: ((state: AppStateStatus) => void) | null = null;
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function job(overrides: Partial<GenerationJob>): GenerationJob {
  return {
    id: "look-job",
    kind: "look",
    client_request_id: "request-look",
    status: "running",
    credit_state: "charged",
    result: null,
    image_path: null,
    error_code: null,
    deadline_at: new Date(Date.now() + 240_000).toISOString(),
    created_at: new Date(Date.now() - 5_000).toISOString(),
    completed_at: null,
    for_look: null,
    look_input: null,
    ...overrides,
  };
}

/** Every kind answers `rows[kind]`, or no job. */
let rows: Partial<Record<GenerationJobKind, GenerationJob>> = {};

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const lookReads = () => fetchJob.mock.calls.filter(([, kind]) => kind === "look").length;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  rows = {};
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  fetchJob.mockImplementation(async (_userId, kind) => ({ status: "ok", job: rows[kind] ?? null }));
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

it("reads her latest look, style sheet and portrait preview jobs", async () => {
  rows.look = job({ status: "succeeded" });
  const { result } = await renderHook(() => useGenerationJobs(), { wrapper });
  await advance(0);

  // Each read carries the query's own signal: a cancelled read stops at once.
  const signal = expect.objectContaining({ aborted: false });
  expect(fetchJob).toHaveBeenCalledWith("member", "look", signal);
  expect(fetchJob).toHaveBeenCalledWith("member", "style_sheet", signal);
  expect(fetchJob).toHaveBeenCalledWith("member", "photo_preview", signal);
  expect(result.current.available).toBe(true);
  expect(result.current.look?.id).toBe("look-job");
  expect(result.current.styleSheet).toBeNull();
  expect(result.current.readAt).toBeGreaterThan(0);
});

it("polls every 3 s while a job is running, and stops once it has settled", async () => {
  rows.look = job({});
  await renderHook(() => useGenerationJobs(), { wrapper });
  await advance(0);
  expect(lookReads()).toBe(1);

  await advance(3_000);
  expect(lookReads()).toBe(2);

  rows.look = job({ status: "succeeded" });
  await advance(3_000);
  expect(lookReads()).toBe(3);

  await advance(15_000);
  expect(lookReads()).toBe(3);
});

it("does not poll when nothing is running", async () => {
  rows.look = job({ status: "failed", error_code: "render_failed" });
  await renderHook(() => useGenerationJobs(), { wrapper });
  await advance(30_000);
  expect(lookReads()).toBe(1);
});

it("reads again when the app comes back from the background", async () => {
  rows.look = job({ status: "succeeded" });
  await renderHook(() => useGenerationJobs(), { wrapper });
  await advance(0);
  expect(lookReads()).toBe(1);

  await act(async () => {
    appStateListener?.("background");
    appStateListener?.("active");
  });
  await advance(0);

  expect(lookReads()).toBe(2);
});

it("reads as unavailable while the migration is not applied, and never polls", async () => {
  fetchJob.mockResolvedValue({ status: "unavailable" });
  const { result } = await renderHook(() => useGenerationJobs(), { wrapper });
  await advance(30_000);

  expect(result.current.available).toBe(false);
  expect(result.current.look).toBeNull();
  expect(lookReads()).toBe(1);
});

it("keeps the last good rows when a later read fails", async () => {
  rows.look = job({});
  const { result } = await renderHook(() => useGenerationJobs(), { wrapper });
  await advance(0);

  fetchJob.mockRejectedValue(new Error("offline"));
  await advance(3_000);

  expect(result.current.available).toBe(true);
  expect(result.current.look?.id).toBe("look-job");
});

it("stops polling a running job once it is past its deadline, even while reads fail", async () => {
  const start = Date.now();
  rows.look = job({ deadline_at: new Date(start + 10_000).toISOString() });
  const { result } = await renderHook(() => useGenerationJobs(), { wrapper });
  await advance(0);

  fetchJob.mockRejectedValue(new Error("offline"));
  // Deadline (10 s) + the reaper's 30 s grace + 15 s of clock skew, then some.
  await advance(70_000);
  const readsAfterDeadline = lookReads();
  await advance(60_000);

  expect(lookReads()).toBe(readsAfterDeadline);
  // The clock the screen judges the row by kept moving while reads failed, so
  // the row now reads as past its deadline there too.
  expect(result.current.readAt).toBeGreaterThan(start + 55_000);
});

describe("useGenerationImage", () => {
  it("reads a succeeded render's image once", async () => {
    fetchImage.mockResolvedValue("data:image/jpeg;base64,QQ==");
    const done = job({ kind: "style_sheet", status: "succeeded", image_path: "member/sheet.jpg" });
    const { result, rerender } = await renderHook(
      ({ row }: { row: GenerationJob | null }) => useGenerationImage(row),
      { wrapper, initialProps: { row: done as GenerationJob | null } },
    );
    expect(result.current).toMatchObject({ image: null, loading: true, failed: false });
    await advance(0);
    await rerender({ row: done });
    await advance(0);

    expect(result.current).toMatchObject({
      image: "data:image/jpeg;base64,QQ==",
      loading: false,
      failed: false,
    });
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(fetchImage).toHaveBeenCalledWith(done, expect.objectContaining({ aborted: false }));
  });

  it("does not retry a failed read on its own: the slot's Retry is the retry, after one 30 s attempt", async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: 3, retryDelay: 0, gcTime: Infinity } },
    });
    fetchImage.mockRejectedValue(new Error("The image took too long to load."));
    const done = job({ kind: "style_sheet", status: "succeeded", image_path: "member/sheet.jpg" });
    const { result } = await renderHook(() => useGenerationImage(done), { wrapper });
    await advance(10);

    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ image: null, loading: false, failed: true });
  });

  it("reads nothing without a succeeded render", async () => {
    const { result } = await renderHook(() => useGenerationImage(null), { wrapper });
    await advance(0);
    expect(result.current).toMatchObject({ image: null, loading: false, failed: false });
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("says so when the image cannot be read, instead of waiting forever", async () => {
    fetchImage.mockRejectedValue(new Error("offline"));
    const done = job({ kind: "style_sheet", status: "succeeded", image_path: "member/sheet.jpg" });
    const { result } = await renderHook(() => useGenerationImage(done), { wrapper });
    await advance(0);

    expect(result.current).toMatchObject({ image: null, loading: false, failed: true });

    let finish: (value: string) => void = () => {};
    fetchImage.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await act(async () => result.current.retry());
    await advance(5);
    // While it is read again the slot waits, rather than offering the retry twice.
    expect(result.current).toMatchObject({ image: null, loading: true, failed: false });

    await act(async () => finish("data:image/jpeg;base64,QQ=="));
    await advance(0);

    expect(fetchImage).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ image: "data:image/jpeg;base64,QQ==", failed: false });
  });
});
