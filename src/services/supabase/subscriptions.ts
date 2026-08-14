import { supabase } from "@/services/supabase/client";

/**
 * The member's own subscription row. **Read only, always.**
 *
 * Every column here is written by the Paddle webhook, which is the system of
 * record (§9). The app never inserts, never updates, and never infers — a
 * checkout completing on the phone is a hint to refetch this row, not a grant.
 *
 * `purchases` is deliberately absent from this file and from the whole app: §7
 * lists it among the tables mobile must never touch.
 */
export type SubscriptionRow = {
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  plan_id: string;
};

/**
 * Newest first, one row. A member can accumulate historical rows — an expired
 * subscription and a current one — and the newest is the one that governs.
 *
 * `paddle_subscription_id` and `paddle_customer_id` are not selected. Nothing
 * on the device may act on either, and a column that is never read cannot be
 * wired into an accidental client-side billing call.
 */
export async function fetchMySubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status,cancel_at_period_end,current_period_end,plan_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
