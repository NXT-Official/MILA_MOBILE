jest.mock("../src/services/supabase/client", () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from "@/services/supabase/client";
import {
  PROFILE_EXTRAS_COLUMNS,
  fetchProfileExtras,
  saveProfileExtras,
} from "@/services/supabase/profile-extras";

/**
 * The Wave D profile columns ship in a migration that may not be applied yet.
 * They are read here, apart from the launch profile, so a missing column is a
 * state ("unavailable") and never a thrown error that breaks a profile read.
 */

type Result = { data?: unknown; error: { code?: string; message?: string } | null };

function mockQuery(result: Result) {
  const query: Record<string, jest.Mock> & { then?: unknown } = {
    select: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  };
  for (const key of Object.keys(query)) query[key].mockReturnValue(query);
  query.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  jest.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
  return query;
}

beforeEach(() => jest.clearAllMocks());

describe("fetchProfileExtras", () => {
  it("reads only the Wave D columns, for her own row", async () => {
    const query = mockQuery({
      data: {
        hair_color: "Auburn",
        last_check_in_at: "2026-10-07T08:00:00Z",
        founding_body_read_at: null,
      },
      error: null,
    });

    const read = await fetchProfileExtras("member");

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(query.select).toHaveBeenCalledWith(PROFILE_EXTRAS_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("id", "member");
    expect(read).toEqual({
      status: "ok",
      extras: {
        hairColor: "Auburn",
        lastCheckInAt: "2026-10-07T08:00:00Z",
        foundingBodyReadAt: null,
      },
    });
  });

  it("reads a blank row as empty extras", async () => {
    mockQuery({ data: null, error: null });
    expect(await fetchProfileExtras("member")).toEqual({
      status: "ok",
      extras: { hairColor: null, lastCheckInAt: null, foundingBodyReadAt: null },
    });
  });

  it.each(["42703", "PGRST204", "PGRST205"])(
    "a missing hair_color column (%s) reads as unavailable, never throws",
    async (code) => {
      mockQuery({
        data: null,
        error: { code, message: "column profiles.hair_color does not exist" },
      });
      await expect(fetchProfileExtras("member")).resolves.toEqual({ status: "unavailable" });
    },
  );

  it("never throws: any other failure is a typed error result", async () => {
    mockQuery({ data: null, error: { code: "08006", message: "connection" } });
    await expect(fetchProfileExtras("member")).resolves.toEqual({ status: "error" });
  });

  it("never throws: a rejected request is a typed error result too", async () => {
    const query = mockQuery({ data: null, error: null });
    query.then = (_resolve: unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve().then(() => reject(new TypeError("Network request failed")));
    await expect(fetchProfileExtras("member")).resolves.toEqual({ status: "error" });
  });
});

describe("saveProfileExtras", () => {
  it("writes only permitted columns", async () => {
    const query = mockQuery({ error: null });

    const outcome = await saveProfileExtras("member", { hair_color: "Auburn" });

    expect(outcome).toBe("saved");
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ hair_color: "Auburn" }));
    expect(query.eq).toHaveBeenCalledWith("id", "member");
  });

  it("refuses a column a member may not write, before anything is sent", async () => {
    mockQuery({ error: null });
    const wider = { hair_color: "Auburn", founding_body_read_at: "x" } as Record<string, unknown>;

    await expect(saveProfileExtras("member", wider)).rejects.toThrow(/founding_body_read_at/);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("answers unavailable when the column is missing", async () => {
    mockQuery({ error: { code: "42703" } });
    await expect(saveProfileExtras("member", { last_check_in_at: "x" })).resolves.toBe("unavailable");
  });

  it("throws any other failure", async () => {
    mockQuery({ error: { code: "42501", message: "denied" } });
    await expect(saveProfileExtras("member", { hair_color: "Red" })).rejects.toMatchObject({
      code: "42501",
    });
  });
});
