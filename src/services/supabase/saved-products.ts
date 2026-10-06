import type { Json } from "@/types/models";

import { supabase } from "./client";

/**
 * Saved pieces: recommended products she kept to come back to. Direct through
 * RLS (§7): no secret, no credit, and no permission the database cannot
 * express. Grants are SELECT/INSERT/DELETE, so a piece is saved or it is gone.
 *
 * The table ships in a migration that may not be applied yet. Until it is, a
 * missing table is a **state**, not an error: every call here answers
 * `unavailable` and never throws for it, so the Save control can hide and the
 * saved screen can say "not yet" instead of crashing.
 *
 * What a saved row shows comes from `snapshot`, which a server trigger copies
 * from `products` at insert time (client values are ignored), so a piece stays
 * readable after the catalogue row is gone. The live `products` join only says
 * whether it can still be bought.
 */
export type SaveSource = "look" | "dupe" | "post_item";

export type SavedProductSnapshot = {
  title: string | null;
  image_url: string | null;
  product_url: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  brand: string | null;
};

/**
 * `gone`: the catalogue row was deleted ("No longer available").
 * `out_of_stock` / `link_broken`: still listed, but not buyable right now.
 */
export type SavedProductAvailability = "available" | "gone" | "out_of_stock" | "link_broken";

export type SavedProduct = {
  id: string;
  product_id: string | null;
  source: SaveSource | null;
  outfit_id: string | null;
  post_item_id: string | null;
  created_at: string;
  snapshot: SavedProductSnapshot;
  availability: SavedProductAvailability;
};

export type SavedProductsList = { status: "ok"; items: SavedProduct[] } | { status: "unavailable" };

export const SAVED_PRODUCT_COLUMNS =
  "id,product_id,source,outfit_id,post_item_id,created_at,snapshot,product:products(in_stock,verification_status)";

// src: https://docs.postgrest.org/en/v12/references/errors.html · PostgREST 12
//   PGRST205 table, PGRST204 column, PGRST200 relationship: not in the schema cache.
// src: https://www.postgresql.org/docs/current/errcodes-appendix.html
//   42P01 undefined_table, 42703 undefined_column.
const SCHEMA_NOT_READY_CODES: ReadonlySet<string> = new Set([
  "PGRST205",
  "PGRST204",
  "PGRST200",
  "42P01",
  "42703",
]);

/** True when the failure means the saved-pieces migration is not (fully) applied. */
export function isSchemaNotReady(error: { code?: string | null } | null | undefined): boolean {
  return Boolean(error?.code && SCHEMA_NOT_READY_CODES.has(error.code));
}

/** 23505 unique_violation: the (user_id, product_id) pair already exists. */
const ALREADY_SAVED = "23505";

const SOURCES: ReadonlySet<string> = new Set<SaveSource>(["look", "dupe", "post_item"]);

type ProductState = { in_stock?: unknown; verification_status?: unknown };

export type SavedProductRow = {
  id: string;
  product_id: string | null;
  source: string;
  outfit_id: string | null;
  post_item_id: string | null;
  created_at: string;
  snapshot: Json | null;
  product: ProductState | ProductState[] | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function amount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function snapshotOf(value: Json | null): SavedProductSnapshot {
  const raw =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    title: text(raw.title),
    image_url: text(raw.image_url),
    product_url: text(raw.product_url),
    price: amount(raw.price),
    currency: text(raw.currency),
    category: text(raw.category),
    brand: text(raw.brand),
  };
}

function availabilityOf(
  productId: string | null,
  embedded: SavedProductRow["product"],
): SavedProductAvailability {
  // A many-to-one embed is an object; tolerate the array form rather than
  // misreport a live product as gone.
  const product = Array.isArray(embedded) ? (embedded[0] ?? null) : embedded;
  if (!productId || !product) return "gone";
  if (product.in_stock === false) return "out_of_stock";
  if (product.verification_status === "broken") return "link_broken";
  return "available";
}

export function parseSavedProduct(row: SavedProductRow): SavedProduct {
  return {
    id: row.id,
    product_id: row.product_id,
    source: SOURCES.has(row.source) ? (row.source as SaveSource) : null,
    outfit_id: row.outfit_id,
    post_item_id: row.post_item_id,
    created_at: row.created_at,
    snapshot: snapshotOf(row.snapshot),
    availability: availabilityOf(row.product_id, row.product),
  };
}

export async function listSavedProducts(userId: string): Promise<SavedProductsList> {
  const { data, error } = await supabase
    .from("saved_products")
    .select(SAVED_PRODUCT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (isSchemaNotReady(error)) return { status: "unavailable" };
  if (error) throw error;

  const rows = (data ?? []) as unknown as SavedProductRow[];
  return { status: "ok", items: rows.map(parseSavedProduct) };
}

export type SaveProductInput = {
  productId: string;
  source: SaveSource;
  outfitId?: string;
  postItemId?: string;
};

export async function saveProduct(
  userId: string,
  input: SaveProductInput,
): Promise<"saved" | "already_saved" | "unavailable"> {
  // No snapshot: the server trigger fills it from `products` and ignores
  // anything a client sends. `user_id` must equal the session's for RLS.
  const { error } = await supabase.from("saved_products").insert({
    user_id: userId,
    product_id: input.productId,
    source: input.source,
    ...(input.outfitId ? { outfit_id: input.outfitId } : {}),
    ...(input.postItemId ? { post_item_id: input.postItemId } : {}),
  });

  if (!error) return "saved";
  // The unique (user_id, product_id) index makes saving idempotent: a double
  // tap, or a second device, is a save, not an error she has to read.
  if (error.code === ALREADY_SAVED) return "already_saved";
  if (isSchemaNotReady(error)) return "unavailable";
  throw error;
}

/**
 * By `productId` from a card's toggle (one row per product, by the unique
 * index), or by row `id` from the saved screen, which is the only way to reach
 * a piece whose product has since been deleted.
 *
 * PostgREST answers a delete that matched nothing with success, so the row
 * count decides: `not_found` means nothing was removed (already gone, or not
 * hers), and no caller may report a removal on it.
 */
export async function removeSavedProduct(
  userId: string,
  target: { id: string } | { productId: string },
): Promise<"removed" | "not_found" | "unavailable"> {
  // src: @supabase/postgrest-js 2.112.2 · dist/index.d.mts: delete({ count?: 'exact' | ... })
  const query = supabase.from("saved_products").delete({ count: "exact" }).eq("user_id", userId);
  const { error, count } = await ("id" in target
    ? query.eq("id", target.id)
    : query.eq("product_id", target.productId));

  if (isSchemaNotReady(error)) return "unavailable";
  if (error) throw error;
  return count ? "removed" : "not_found";
}
