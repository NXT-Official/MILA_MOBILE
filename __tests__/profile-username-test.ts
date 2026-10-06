jest.mock("../src/services/supabase/client", () => ({
  supabase: { from: jest.fn() },
}));
jest.mock("../src/services/supabase/storage", () => ({
  getSignedProfilePhotoUrl: jest.fn(),
  removeProfilePhoto: jest.fn(),
  uploadProfilePhoto: jest.fn(),
}));

import { supabase } from "@/services/supabase/client";
import { fetchProfile } from "@/services/supabase/profile";
import { PROFILE_READ_COLUMNS } from "@/types/models";

/**
 * The member's handle is her profile's `username`. Every surface that shows a
 * handle reads it from the profile query, so the query has to ask for it and
 * the normalised profile has to carry it.
 */
function mockRow(row: Record<string, unknown> | null) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
  };
  jest.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
  return query;
}

test("the profile read asks for the username", async () => {
  const query = mockRow({ username: "janed" });
  await fetchProfile("member");

  expect(PROFILE_READ_COLUMNS.split(",")).toContain("username");
  expect(query.select).toHaveBeenCalledWith(PROFILE_READ_COLUMNS);
});

test("the normalised profile carries her username", async () => {
  mockRow({ username: "janed", full_name: "Jane Doe" });

  expect((await fetchProfile("member")).username).toBe("janed");
});

test("a profile with no username, or no row, has none rather than a made-up one", async () => {
  mockRow({ full_name: "Jane Doe" });
  expect((await fetchProfile("member")).username).toBeNull();

  mockRow(null);
  expect((await fetchProfile("member")).username).toBeNull();
});
