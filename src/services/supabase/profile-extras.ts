import { assertWritableColumns } from "@/lib/profile-columns";

import { supabase } from "./client";
import { isSchemaNotReady } from "./saved-products";

/**
 * The Wave D profile columns, read and written apart from the launch profile.
 *
 * They ship in an additive web migration that may not be applied yet. A column
 * that does not exist makes the whole `select` fail, so none of them is ever in
 * `PROFILE_READ_COLUMNS`: a missing column there would break every profile read
 * and the launch gate. Here a missing column is a **state** (`unavailable`),
 * and every Wave D surface hides itself on it.
 */

/** Hair colour and the check-in clock are member-writable; the body-scan stamp is server-written. */
export const PROFILE_EXTRAS_COLUMNS = "hair_color,last_check_in_at,founding_body_read_at";

export type ProfileExtras = {
  hairColor: string | null;
  lastCheckInAt: string | null;
  foundingBodyReadAt: string | null;
};

export type ProfileExtrasRead = { status: "ok"; extras: ProfileExtras } | { status: "unavailable" };

type ExtrasRow = {
  hair_color?: unknown;
  last_check_in_at?: unknown;
  founding_body_read_at?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export async function fetchProfileExtras(userId: string): Promise<ProfileExtrasRead> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_EXTRAS_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (isSchemaNotReady(error)) return { status: "unavailable" };
  if (error) throw error;

  const row = (data ?? {}) as ExtrasRow;
  return {
    status: "ok",
    extras: {
      hairColor: text(row.hair_color),
      lastCheckInAt: text(row.last_check_in_at),
      foundingBodyReadAt: text(row.founding_body_read_at),
    },
  };
}

/** The member-writable Wave D columns. `founding_body_read_at` is deliberately absent. */
export type ProfileExtrasUpdate = {
  hair_color?: string | null;
  last_check_in_at?: string | null;
};

/**
 * Both columns go through `assertWritableColumns`, the same last check every
 * profile write has (§7). `saved` when written, `unavailable` when the column
 * does not exist yet; any other failure throws.
 */
export async function saveProfileExtras(
  userId: string,
  payload: ProfileExtrasUpdate,
): Promise<"saved" | "unavailable"> {
  assertWritableColumns(payload);

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);

  if (isSchemaNotReady(error)) return "unavailable";
  if (error) throw error;
  return "saved";
}
