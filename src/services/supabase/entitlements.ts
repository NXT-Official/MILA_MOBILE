import { supabase } from "@/services/supabase/client";

/**
 * Read-only, always. `user_entitlements` is written by the server (§7) — the
 * Paddle webhook and the credit RPCs own every column here. The app displays
 * the row and nothing else: it does not predict the daily reset, does not
 * decrement on spend, and does not decide whether an action is affordable.
 */
export type Entitlements = {
  ai_credits: number;
  purchased_credits: number;
};

const NO_ENTITLEMENTS: Entitlements = { ai_credits: 0, purchased_credits: 0 };

export async function fetchEntitlements(userId: string): Promise<Entitlements> {
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("ai_credits,purchased_credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  // A member with no row has no credits. `DEFAULT_AI_CREDITS` is 0, so this is
  // the ordinary first-run state and not an error worth a retry.
  return data ?? NO_ENTITLEMENTS;
}
