jest.mock("../src/services/supabase/client", () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => "0b9d6a52-3c7e-4f8a-9d61-2f4e8c1a7b30") }));

import { supabase } from "@/services/supabase/client";
import {
  fetchGenerationImage,
  fetchGenerationJobByRequest,
  fetchLatestGenerationJob,
  GENERATION_IMAGE_TIMEOUT_MS,
  GENERATION_JOB_COLUMNS,
  GENERATION_READ_TIMEOUT_MS,
  newClientRequestId,
  type GenerationJob,
} from "@/services/supabase/generation-jobs";

/**
 * Generation jobs, read direct through RLS (members SELECT their own rows).
 * The table ships in a migration that may not be applied yet: a missing table
 * is a state ("unavailable"), never a thrown error, so Home keeps today's
 * behaviour until it exists. Images are read only for a succeeded row's own
 * `image_path`, never by listing her folder.
 */

type Result = { data?: unknown; error: { code?: string; message?: string } | null };

/**
 * A chainable PostgREST stand-in. `result` answers at once; `"hang"` never
 * answers until the request's abort signal fires, then answers the way
 * postgrest-js reports an aborted request: as `{ error }`.
 */
function mockQuery(result: Result | "hang") {
  const query: Record<string, jest.Mock> & { then?: unknown } = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    abortSignal: jest.fn(),
  };
  for (const key of Object.keys(query)) query[key].mockReturnValue(query);
  const answer = (): Promise<Result> => {
    if (result !== "hang") return Promise.resolve(result);
    const signal = query.abortSignal.mock.calls.at(-1)?.[0] as AbortSignal | undefined;
    const aborted: Result = { data: null, error: { message: "AbortError: Aborted" } };
    return new Promise((resolve) => {
      if (signal?.aborted) resolve(aborted);
      else signal?.addEventListener("abort", () => resolve(aborted));
    });
  };
  query.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    answer().then(resolve, reject);
  jest.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
  return query;
}

/** A row as PostgREST answers the select (JSON paths arrive as their aliases). */
const wireRow = {
  id: "job-1",
  kind: "look",
  client_request_id: "request-1",
  status: "succeeded",
  credit_state: "charged",
  result: { outfit: { headline: "Linen and light" } },
  image_path: null,
  error_code: null,
  deadline_at: "2026-10-07T08:05:00Z",
  created_at: "2026-10-07T08:00:00Z",
  completed_at: "2026-10-07T08:01:00Z",
  look_vibe: "Brunch",
  look_weather: "24°C Sunny (in Manila)",
  for_headline: null,
  for_description: null,
};

/** The same row, parsed. */
const row = {
  id: "job-1",
  kind: "look",
  client_request_id: "request-1",
  status: "succeeded",
  credit_state: "charged",
  result: { outfit: { headline: "Linen and light" } },
  image_path: null,
  error_code: null,
  deadline_at: "2026-10-07T08:05:00Z",
  created_at: "2026-10-07T08:00:00Z",
  completed_at: "2026-10-07T08:01:00Z",
  for_look: null,
  look_input: { vibe: "Brunch", weather: "24°C Sunny (in Manila)" },
};

beforeEach(() => jest.clearAllMocks());

describe("newClientRequestId", () => {
  it("is a fresh v4 uuid from the platform's secure random source", () => {
    expect(newClientRequestId()).toBe("0b9d6a52-3c7e-4f8a-9d61-2f4e8c1a7b30");
  });
});

describe("fetchLatestGenerationJob", () => {
  it("reads her newest job of one kind, without the stored request input", async () => {
    const query = mockQuery({ data: [wireRow], error: null });

    const read = await fetchLatestGenerationJob("member", "look");

    expect(supabase.from).toHaveBeenCalledWith("generation_jobs");
    expect(query.select).toHaveBeenCalledWith(GENERATION_JOB_COLUMNS);
    // Only named fields of the request are read, never the whole input.
    expect(GENERATION_JOB_COLUMNS.split(",")).not.toContain("input");
    expect(GENERATION_JOB_COLUMNS).toContain("for_headline:input->outfit->outfit->>headline");
    expect(GENERATION_JOB_COLUMNS).toContain("look_vibe:input->>vibe");
    expect(query.eq).toHaveBeenCalledWith("user_id", "member");
    expect(query.eq).toHaveBeenCalledWith("kind", "look");
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(read).toEqual({ status: "ok", job: row });
  });

  it("answers no job when she has none yet", async () => {
    mockQuery({ data: [], error: null });
    await expect(fetchLatestGenerationJob("member", "style_sheet")).resolves.toEqual({
      status: "ok",
      job: null,
    });
  });

  it.each(["PGRST205", "42P01", "42703"])(
    "answers unavailable when the migration is not applied (%s)",
    async (code) => {
      mockQuery({ data: null, error: { code, message: "missing" } });
      await expect(fetchLatestGenerationJob("member", "look")).resolves.toEqual({
        status: "unavailable",
      });
    },
  );

  it("throws any other failure, so the last good read stays on screen", async () => {
    const error = { code: "42501", message: "permission denied" };
    mockQuery({ data: null, error });
    await expect(fetchLatestGenerationJob("member", "look")).rejects.toBe(error);
  });

  it("ignores a row it cannot read rather than guessing at it", async () => {
    mockQuery({ data: [{ ...wireRow, status: "paused" }], error: null });
    await expect(fetchLatestGenerationJob("member", "look")).resolves.toEqual({
      status: "ok",
      job: null,
    });
  });

  it("gives up on a read that does not answer, so the screen is never held by a hung request", async () => {
    jest.useFakeTimers();
    try {
      const query = mockQuery("hang");
      const read = fetchLatestGenerationJob("member", "look");
      const settled = jest.fn();
      read.then(settled, settled);

      await jest.advanceTimersByTimeAsync(GENERATION_READ_TIMEOUT_MS - 1);
      expect(settled).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);

      await expect(read).rejects.toMatchObject({ message: expect.stringMatching(/abort/i) });
      expect(query.abortSignal).toHaveBeenCalledWith(expect.any(Object));
      expect(GENERATION_READ_TIMEOUT_MS).toBe(10_000);
    } finally {
      jest.useRealTimers();
    }
  });

  it("stops when the query that asked is cancelled", async () => {
    const query = mockQuery("hang");
    const cancel = new AbortController();
    const read = fetchLatestGenerationJob("member", "look", cancel.signal);
    cancel.abort();
    await expect(read).rejects.toBeTruthy();
    expect((query.abortSignal.mock.calls[0][0] as AbortSignal).aborted).toBe(true);
  });

  it("names the look a style sheet or portrait was drawn for", async () => {
    mockQuery({
      data: [
        {
          ...wireRow,
          kind: "style_sheet",
          credit_state: "refunded",
          look_vibe: null,
          look_weather: null,
          for_headline: "Linen and light",
          for_description: "A light layer.",
        },
      ],
      error: null,
    });
    const read = await fetchLatestGenerationJob("member", "style_sheet");
    expect(read).toMatchObject({
      status: "ok",
      job: {
        kind: "style_sheet",
        credit_state: "refunded",
        for_look: { headline: "Linen and light", description: "A light layer." },
        look_input: null,
      },
    });
  });
});

describe("fetchGenerationJobByRequest", () => {
  it("reads her one row for a press key, within the same deadline", async () => {
    const query = mockQuery({ data: [wireRow], error: null });
    await expect(fetchGenerationJobByRequest("member", "look", "request-1")).resolves.toEqual({
      status: "ok",
      job: row,
    });
    expect(supabase.from).toHaveBeenCalledWith("generation_jobs");
    expect(query.eq).toHaveBeenCalledWith("user_id", "member");
    expect(query.eq).toHaveBeenCalledWith("kind", "look");
    expect(query.eq).toHaveBeenCalledWith("client_request_id", "request-1");
    expect(query.abortSignal).toHaveBeenCalled();
  });

  it("answers no job when the press never reached the server, and unavailable without the migration", async () => {
    mockQuery({ data: [], error: null });
    await expect(fetchGenerationJobByRequest("member", "look", "request-1")).resolves.toEqual({
      status: "ok",
      job: null,
    });
    mockQuery({ data: null, error: { code: "PGRST205" } });
    await expect(fetchGenerationJobByRequest("member", "look", "request-1")).resolves.toEqual({
      status: "unavailable",
    });
  });
});

describe("fetchGenerationImage", () => {
  const sheetJob: GenerationJob = {
    ...row,
    kind: "style_sheet",
    result: { mode: "style_sheet" },
    image_path: "member/job-1.jpg",
    for_look: { headline: "Linen and light", description: "A light layer." },
    look_input: null,
  } as GenerationJob;

  const createSignedUrl = jest.fn();
  const originalFetch = global.fetch;
  const originalFileReader = global.FileReader;
  let blobType = "image/jpeg";
  const blobClose = jest.fn();

  beforeEach(() => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.test/signed/job-1.jpg" },
      error: null,
    });
    jest
      .mocked(supabase.storage.from)
      .mockReturnValue({ createSignedUrl } as unknown as ReturnType<typeof supabase.storage.from>);
    blobType = "image/jpeg";
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => ({ type: blobType, size: 1, close: blobClose }),
    })) as unknown as typeof fetch;
    // React Native's FileReader reads a Blob natively; this stand-in answers
    // the way it does: a data URI whose media type is the blob's own.
    global.FileReader = class {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(blob: { type: string }) {
        this.result = `data:${blob.type};base64,QQ==`;
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof FileReader;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    global.FileReader = originalFileReader;
  });

  it("signs the succeeded row's own path in the private bucket and returns the image", async () => {
    await expect(fetchGenerationImage(sheetJob)).resolves.toBe("data:image/jpeg;base64,QQ==");

    expect(supabase.storage.from).toHaveBeenCalledWith("generations");
    expect(createSignedUrl).toHaveBeenCalledWith("member/job-1.jpg", expect.any(Number));
    expect(global.fetch).toHaveBeenCalledWith(
      "https://storage.test/signed/job-1.jpg",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  it("names the image type from its path when the download carries none, or not an image type", async () => {
    blobType = "";
    await expect(
      fetchGenerationImage({ ...sheetJob, image_path: "member/job-1.png" }),
    ).resolves.toBe("data:image/png;base64,QQ==");
    blobType = "application/octet-stream";
    await expect(
      fetchGenerationImage({ ...sheetJob, image_path: "member/job-1.webp" }),
    ).resolves.toBe("data:image/webp;base64,QQ==");
  });

  it("frees the native blob once it has been read", async () => {
    await fetchGenerationImage(sheetJob);
    expect(blobClose).toHaveBeenCalled();
  });

  it("never signs anything for a row that has not succeeded", async () => {
    await expect(fetchGenerationImage({ ...sheetJob, status: "running" })).rejects.toThrow();
    await expect(
      fetchGenerationImage({ ...sheetJob, status: "failed", error_code: "qa_failed" }),
    ).rejects.toThrow();
    await expect(fetchGenerationImage({ ...sheetJob, image_path: null })).rejects.toThrow();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("gives up on an image that does not arrive, so the slot can offer its retry", async () => {
    jest.useFakeTimers();
    try {
      let downloadSignal: AbortSignal | undefined;
      global.fetch = jest.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            downloadSignal = init?.signal;
            init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
          }),
      ) as unknown as typeof fetch;
      const read = fetchGenerationImage(sheetJob);
      const settled = jest.fn();
      read.then(settled, settled);

      await jest.advanceTimersByTimeAsync(GENERATION_IMAGE_TIMEOUT_MS - 1);
      expect(settled).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);

      await expect(read).rejects.toBeTruthy();
      expect(downloadSignal?.aborted).toBe(true);
      expect(GENERATION_IMAGE_TIMEOUT_MS).toBe(30_000);
    } finally {
      jest.useRealTimers();
    }
  });

  it("also gives up when the signed link itself never comes back", async () => {
    jest.useFakeTimers();
    try {
      createSignedUrl.mockReturnValue(new Promise(() => {}));
      const read = fetchGenerationImage(sheetJob);
      const settled = jest.fn();
      read.then(settled, settled);
      await jest.advanceTimersByTimeAsync(GENERATION_IMAGE_TIMEOUT_MS);
      expect(settled).toHaveBeenCalled();
      await expect(read).rejects.toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("fails when the signed link cannot be made or the download is refused", async () => {
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    await expect(fetchGenerationImage(sheetJob)).rejects.toBeTruthy();

    global.fetch = jest.fn(async () => ({ ok: false, status: 403 })) as unknown as typeof fetch;
    await expect(fetchGenerationImage(sheetJob)).rejects.toThrow();
  });
});
