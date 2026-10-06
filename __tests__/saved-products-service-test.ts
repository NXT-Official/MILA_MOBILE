jest.mock("../src/services/supabase/client", () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from "@/services/supabase/client";
import {
  isSchemaNotReady,
  listSavedProducts,
  parseSavedProduct,
  removeSavedProduct,
  saveProduct,
  SAVED_PRODUCT_COLUMNS,
} from "@/services/supabase/saved-products";

/**
 * Saved pieces, direct through RLS. The table ships in a migration that may
 * not be applied yet, so a missing table is a state ("unavailable"), never a
 * thrown error: until it exists the Save control hides and the screen says so.
 */

type Result = {
  data?: unknown;
  count?: number | null;
  error: { code?: string; message?: string } | null;
};

/** A chainable PostgREST stand-in that resolves to `result` when awaited. */
function mockQuery(result: Result) {
  const query: Record<string, jest.Mock> & { then?: unknown } = {
    select: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
  };
  for (const key of Object.keys(query)) query[key].mockReturnValue(query);
  query.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  jest.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
  return query;
}

const row = {
  id: "row-1",
  product_id: "product-1",
  source: "look",
  outfit_id: null,
  post_item_id: null,
  created_at: "2026-10-07T08:00:00Z",
  snapshot: {
    title: "Wide-leg jeans",
    image_url: "https://cdn.example.test/jeans.jpg",
    product_url: "https://shop.example.test/jeans",
    price: 49,
    currency: "USD",
    category: "Bottoms",
    brand: "Example Denim",
  },
  product: { in_stock: true, verification_status: "verified" },
};

beforeEach(() => jest.clearAllMocks());

describe("listSavedProducts", () => {
  it("reads her own rows, newest first, with the live product state", async () => {
    const query = mockQuery({ data: [row], error: null });
    const result = await listSavedProducts("member");

    expect(supabase.from).toHaveBeenCalledWith("saved_products");
    expect(query.select).toHaveBeenCalledWith(SAVED_PRODUCT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("user_id", "member");
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual({
      status: "ok",
      items: [
        {
          id: "row-1",
          product_id: "product-1",
          source: "look",
          outfit_id: null,
          post_item_id: null,
          created_at: "2026-10-07T08:00:00Z",
          snapshot: row.snapshot,
          availability: "available",
        },
      ],
    });
  });

  it.each(["PGRST205", "42P01", "42703"])(
    "reports %s (the migration is not applied) as unavailable instead of throwing",
    async (code) => {
      mockQuery({ data: null, error: { code, message: "missing" } });
      await expect(listSavedProducts("member")).resolves.toEqual({ status: "unavailable" });
    },
  );

  it("throws any other failure, so the screen can offer a retry", async () => {
    mockQuery({ data: null, error: { code: "08006", message: "connection failure" } });
    await expect(listSavedProducts("member")).rejects.toMatchObject({ code: "08006" });
  });
});

describe("parseSavedProduct", () => {
  it("marks a deleted product as gone", () => {
    expect(parseSavedProduct({ ...row, product_id: null, product: null }).availability).toBe("gone");
    expect(parseSavedProduct({ ...row, product: null }).availability).toBe("gone");
  });

  it("marks an out-of-stock product and a broken link", () => {
    expect(
      parseSavedProduct({ ...row, product: { in_stock: false, verification_status: "verified" } })
        .availability,
    ).toBe("out_of_stock");
    expect(
      parseSavedProduct({ ...row, product: { in_stock: true, verification_status: "broken" } })
        .availability,
    ).toBe("link_broken");
  });

  it("survives a thin or malformed snapshot without inventing values", () => {
    const parsed = parseSavedProduct({ ...row, snapshot: { price: "12.5" } });
    expect(parsed.snapshot).toEqual({
      title: null,
      image_url: null,
      product_url: null,
      price: 12.5,
      currency: null,
      category: null,
      brand: null,
    });
    expect(parseSavedProduct({ ...row, snapshot: null }).snapshot.title).toBeNull();
  });

  it("reads an embedded product delivered as a one-row array", () => {
    expect(
      parseSavedProduct({ ...row, product: [{ in_stock: false, verification_status: "verified" }] })
        .availability,
    ).toBe("out_of_stock");
  });
});

describe("saveProduct", () => {
  it("sends the ids and the source; the server fills the snapshot (the {} sent satisfies the not-null column and is overwritten)", async () => {
    const query = mockQuery({ error: null });
    await expect(
      saveProduct("member", { productId: "product-1", source: "dupe" }),
    ).resolves.toBe("saved");

    expect(supabase.from).toHaveBeenCalledWith("saved_products");
    expect(query.insert).toHaveBeenCalledWith({
      user_id: "member",
      product_id: "product-1",
      source: "dupe",
      snapshot: {},
    });
  });

  it("passes the outfit or post item the piece came from", async () => {
    const query = mockQuery({ error: null });
    await saveProduct("member", { productId: "p", source: "post_item", postItemId: "item-9" });
    expect(query.insert).toHaveBeenCalledWith({
      user_id: "member",
      product_id: "p",
      source: "post_item",
      post_item_id: "item-9",
      snapshot: {},
    });

    await saveProduct("member", { productId: "p", source: "look", outfitId: "outfit-3" });
    expect(query.insert).toHaveBeenLastCalledWith({
      user_id: "member",
      product_id: "p",
      source: "look",
      outfit_id: "outfit-3",
      snapshot: {},
    });
  });

  it("treats a unique violation as already saved, not an error", async () => {
    mockQuery({ error: { code: "23505", message: "duplicate" } });
    await expect(saveProduct("member", { productId: "p", source: "look" })).resolves.toBe(
      "already_saved",
    );
  });

  it("reports a missing table as unavailable", async () => {
    mockQuery({ error: { code: "PGRST205", message: "missing" } });
    await expect(saveProduct("member", { productId: "p", source: "look" })).resolves.toBe(
      "unavailable",
    );
  });

  it("throws anything else", async () => {
    mockQuery({ error: { code: "42501", message: "denied" } });
    await expect(saveProduct("member", { productId: "p", source: "look" })).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("removeSavedProduct", () => {
  it("removes by product from a card's toggle", async () => {
    const query = mockQuery({ error: null, count: 1 });
    await expect(removeSavedProduct("member", { productId: "product-1" })).resolves.toBe("removed");
    expect(query.delete).toHaveBeenCalledWith({ count: "exact" });
    expect(query.eq).toHaveBeenCalledWith("user_id", "member");
    expect(query.eq).toHaveBeenCalledWith("product_id", "product-1");
  });

  it("removes by row from the saved screen, which also reaches pieces whose product is gone", async () => {
    const query = mockQuery({ error: null, count: 1 });
    await expect(removeSavedProduct("member", { id: "row-1" })).resolves.toBe("removed");
    expect(query.eq).toHaveBeenCalledWith("user_id", "member");
    expect(query.eq).toHaveBeenCalledWith("id", "row-1");
  });

  it("never reports a removal when the delete matched no row", async () => {
    // PostgREST answers a zero-row delete with success; only the count tells.
    mockQuery({ error: null, count: 0 });
    await expect(removeSavedProduct("member", { productId: "product-1" })).resolves.toBe(
      "not_found",
    );
  });

  it("reports a missing table as unavailable and throws anything else", async () => {
    mockQuery({ error: { code: "42P01", message: "missing" } });
    await expect(removeSavedProduct("member", { id: "row-1" })).resolves.toBe("unavailable");

    mockQuery({ error: { code: "08006", message: "down" } });
    await expect(removeSavedProduct("member", { id: "row-1" })).rejects.toMatchObject({
      code: "08006",
    });
  });
});

test("isSchemaNotReady recognises only the not-yet-migrated codes", () => {
  for (const code of ["PGRST205", "42P01", "42703", "PGRST204", "PGRST200"]) {
    expect(isSchemaNotReady({ code })).toBe(true);
  }
  for (const code of ["23505", "42501", "08006", undefined]) {
    expect(isSchemaNotReady({ code })).toBe(false);
  }
  expect(isSchemaNotReady(null)).toBe(false);
});
