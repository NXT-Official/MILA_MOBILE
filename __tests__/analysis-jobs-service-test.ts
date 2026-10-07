jest.mock("../src/services/supabase/client", () => ({
  supabase: { from: jest.fn() },
}));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => "0b9d6a52-3c7e-4f8a-9d61-2f4e8c1a7b30") }));

import { supabase } from "@/services/supabase/client";
import {
  ANALYSIS_JOB_COLUMNS,
  fetchLatestAnalysisJob,
  newClientRequestId,
  parseAnalysisJob,
} from "@/services/supabase/analysis-jobs";

/**
 * Her colour read, check-in and body scan jobs, read direct through RLS. The
 * table may not exist yet: that is a state ("unavailable"), never an error.
 * Photos are never in a job row, and the whole `input` is never selected.
 */

type Result = { data?: unknown; error: { code?: string; message?: string } | null };

function mockQuery(result: Result) {
  const query: Record<string, jest.Mock> & { then?: unknown } = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
  };
  for (const key of Object.keys(query)) query[key].mockReturnValue(query);
  query.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  jest.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
  return query;
}

const wireRow = {
  id: "job-1",
  kind: "check_in",
  client_request_id: "request-1",
  status: "succeeded",
  credit_state: "charged",
  result: { read: { hairColor: "Auburn" } },
  error_code: null,
  deadline_at: "2026-10-07T08:05:00Z",
  created_at: "2026-10-07T08:00:00Z",
  completed_at: "2026-10-07T08:01:00Z",
};

beforeEach(() => jest.clearAllMocks());

it("reads one kind, newest first, through her own rows", async () => {
  const query = mockQuery({ data: [wireRow], error: null });

  const latest = await fetchLatestAnalysisJob("member", "check_in");

  expect(supabase.from).toHaveBeenCalledWith("generation_jobs");
  expect(query.select).toHaveBeenCalledWith(ANALYSIS_JOB_COLUMNS);
  expect(query.eq).toHaveBeenCalledWith("user_id", "member");
  expect(query.eq).toHaveBeenCalledWith("kind", "check_in");
  expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  expect(query.limit).toHaveBeenCalledWith(1);
  expect(latest).toEqual({
    status: "ok",
    job: expect.objectContaining({ id: "job-1", kind: "check_in" }),
  });
});

it("never selects the job input, which is not hers to render", () => {
  expect(ANALYSIS_JOB_COLUMNS.split(",")).not.toContain("input");
});

it("answers no job when she has none", async () => {
  mockQuery({ data: [], error: null });
  expect(await fetchLatestAnalysisJob("member", "body_scan")).toEqual({ status: "ok", job: null });
});

it("skips unknown rows instead of guessing at them", async () => {
  mockQuery({ data: [{ ...wireRow, kind: "something_new" }], error: null });
  expect(await fetchLatestAnalysisJob("member", "check_in")).toEqual({ status: "ok", job: null });

  expect(parseAnalysisJob(null)).toBeNull();
  expect(parseAnalysisJob({ ...wireRow, status: "weird" })).toBeNull();
  expect(parseAnalysisJob({ ...wireRow, id: "" })).toBeNull();
  expect(parseAnalysisJob({ ...wireRow, deadline_at: null })).toBeNull();
});

it("never returns a row of another kind", async () => {
  mockQuery({ data: [{ ...wireRow, kind: "color_read" }], error: null });
  expect(await fetchLatestAnalysisJob("member", "check_in")).toEqual({ status: "ok", job: null });
});

it.each(["42P01", "PGRST205"])("a missing table (%s) is unavailable", async (code) => {
  mockQuery({ data: null, error: { code } });
  expect(await fetchLatestAnalysisJob("member", "check_in")).toEqual({ status: "unavailable" });
});

it("never throws: any other failure is a typed error result", async () => {
  mockQuery({ data: null, error: { code: "08006", message: "connection" } });
  await expect(fetchLatestAnalysisJob("member", "check_in")).resolves.toEqual({ status: "error" });
});

it("never throws: a rejected request is a typed error result too", async () => {
  const query = mockQuery({ data: null, error: null });
  query.then = (_resolve: unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve().then(() => reject(new TypeError("Network request failed")));
  await expect(fetchLatestAnalysisJob("member", "check_in")).resolves.toEqual({ status: "error" });
});

it("defaults an unknown credit state to none", () => {
  expect(parseAnalysisJob({ ...wireRow, credit_state: "odd" })?.credit_state).toBe("none");
});

it("mints a UUID for each press", () => {
  expect(newClientRequestId()).toBe("0b9d6a52-3c7e-4f8a-9d61-2f4e8c1a7b30");
});
