import { supabase } from "@/services/supabase/client";

export type SubscriptionPlan = {
  id: string;
  slug: string;
  title: string;
  description: string;
  features: string[];
  price_amount: number;
  currency: string;
  billing_interval: string;
  credits_included: number;
  is_featured: boolean;
};

/**
 * Active, non-archived plans in the web's display order (§15 task 14).
 * `paddle_price_id` is deliberately not selected — nothing on mobile may act on
 * it until checkout lands in Phase 09, and a column that is never read cannot
 * be wired into an accidental client-side purchase.
 */
export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(
      "id,slug,title,description,features,price_amount,currency,billing_interval,credits_included,is_featured",
    )
    .eq("is_active", true)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * The live plan's daily allowance, by id — one column, for `effectiveCredits`.
 * A plan row can be archived between the subscription read and this one, hence
 * the null rather than a throw: no plan means no allowance is owed.
 */
export async function fetchPlanAllowance(planId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("credits_included")
    .eq("id", planId)
    .maybeSingle();

  if (error) throw error;
  return data?.credits_included ?? null;
}
