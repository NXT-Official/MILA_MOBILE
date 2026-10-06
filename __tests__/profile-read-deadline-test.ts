/**
 * `fetchProfile` puts a deadline on the profile read.
 *
 * React Native's fetch sets no timeout, and the launch gate waits on this read
 * (re-review N2): on a stalled connection it never answered, so the query
 * never failed and never retried. With the deadline the request is aborted,
 * the read fails, and the query's normal retry runs. The query's own `signal`
 * (a cancelled or superseded fetch) still aborts it too.
 *
 * postgrest-js returns an aborted request as `{ error }` rather than throwing,
 * and `fetchProfile` throws that error.
 * src: node_modules/@supabase/postgrest-js/dist/index.d.cts `abortSignal` · 2.112.2
 */
jest.mock("../src/services/supabase/client", () => ({
  supabase: { from: jest.fn() },
}));
jest.mock("../src/services/supabase/storage", () => ({
  getSignedProfilePhotoUrl: jest.fn(),
  removeProfilePhoto: jest.fn(),
  uploadProfilePhoto: jest.fn(),
}));

import { supabase } from "@/services/supabase/client";
import { fetchProfile, PROFILE_READ_TIMEOUT_MS } from "@/services/supabase/profile";

type FakeQuery = {
  select: jest.Mock;
  eq: jest.Mock;
  abortSignal: jest.Mock;
  maybeSingle: jest.Mock;
};

/** A profile query whose request answers only when its signal aborts it. */
function stalledQuery(): FakeQuery {
  let signal: AbortSignal | null = null;
  const query: FakeQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    abortSignal: jest.fn((s: AbortSignal): FakeQuery => {
      signal = s;
      return query;
    }),
    maybeSingle: jest.fn(
      () =>
        new Promise((resolve) => {
          signal?.addEventListener("abort", () =>
            resolve({ data: null, error: { message: "AbortError: Aborted", code: "" } }),
          );
        }),
    ),
  };
  jest.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
  return query;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("gives up on a stalled profile read after the deadline, so the query can retry", async () => {
  stalledQuery();
  const read = fetchProfile("member");
  const outcome = expect(read).rejects.toMatchObject({ message: "AbortError: Aborted" });

  await jest.advanceTimersByTimeAsync(PROFILE_READ_TIMEOUT_MS - 100);
  let settled = false;
  void read.then(
    () => (settled = true),
    () => (settled = true),
  );
  await Promise.resolve();
  expect(settled).toBe(false);

  await jest.advanceTimersByTimeAsync(200);
  await outcome;
});

it("stops at once when the query cancels it", async () => {
  stalledQuery();
  const cancel = new AbortController();
  const read = fetchProfile("member", cancel.signal);
  const outcome = expect(read).rejects.toMatchObject({ message: "AbortError: Aborted" });

  cancel.abort();
  await outcome;
});

it("still reads the profile normally when the answer comes in time", async () => {
  const query = stalledQuery();
  query.maybeSingle.mockResolvedValue({ data: { username: "member" }, error: null } as never);

  await expect(fetchProfile("member")).resolves.toMatchObject({ username: "member" });
  expect(query.abortSignal).toHaveBeenCalled();
});
