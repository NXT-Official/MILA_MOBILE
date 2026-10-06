jest.mock("../src/services/api/posts", () => ({
  getMemberProfile: jest.fn().mockResolvedValue({ posts: [] }),
}));
jest.mock("../src/services/supabase/profile", () => ({
  fetchProfile: jest.fn().mockResolvedValue({ id: "member" }),
}));
jest.mock("../src/services/supabase/outfits", () => ({
  fetchOutfits: jest.fn().mockResolvedValue([]),
}));
jest.mock("../src/services/supabase/palettes", () => ({
  fetchSavedPalettes: jest.fn().mockResolvedValue([]),
}));
jest.mock("../src/services/supabase/saved-products", () => ({
  listSavedProducts: jest.fn(),
}));
jest.mock("../src/services/supabase/client", () => {
  const favourites = {
    select: () => favourites,
    eq: () => favourites,
    order: () => Promise.resolve({ data: [{ id: "fav-1" }], error: null }),
  };
  return { supabase: { from: () => favourites } };
});

import { assembleExport } from "@/services/export";
import { listSavedProducts } from "@/services/supabase/saved-products";

/**
 * The export already promised "favourites"; the pieces she saves are hers too,
 * so they go in the file. Until the saved-pieces table exists there is nothing
 * of hers to export, which is not a failure.
 */
const account = { id: "member", email: null };

beforeEach(() => jest.clearAllMocks());

test("her saved pieces are in the export, beside everything that was there before", async () => {
  const saved = { id: "row-1", product_id: "p", snapshot: { title: "Wide-leg jeans" } };
  jest.mocked(listSavedProducts).mockResolvedValue({ status: "ok", items: [saved] as never });

  const data = await assembleExport(account);

  expect(listSavedProducts).toHaveBeenCalledWith("member");
  expect(data.saved_products).toEqual([saved]);
  expect(data.favourites).toEqual([{ id: "fav-1" }]);
  expect(data).toMatchObject({ account, profile: { id: "member" }, outfits: [], posts: [] });
  expect(data.saved_palettes).toEqual([]);
});

test("before the table exists the export still succeeds, without the section", async () => {
  jest.mocked(listSavedProducts).mockResolvedValue({ status: "unavailable" });

  const data = await assembleExport(account);

  expect(data).not.toHaveProperty("saved_products");
  expect(data.favourites).toEqual([{ id: "fav-1" }]);
});

test("a failed read of saved pieces fails the export rather than dropping them silently", async () => {
  jest.mocked(listSavedProducts).mockRejectedValue(new Error("offline"));
  await expect(assembleExport(account)).rejects.toThrow("offline");
});
