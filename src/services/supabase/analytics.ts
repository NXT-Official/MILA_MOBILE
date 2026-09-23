import type { Json } from "@/types/models";

import { supabase } from "./client";

/**
 * Product analytics. Direct through RLS (§7): no secret, no credit, and no
 * permission the database cannot express — insert-only, own user_id, same
 * shape as saved_palettes.
 */
export type TrackedEventName =
  | "signup_completed"
  | "onboarding_completed"
  | "look_generated"
  | "purchase_started";

// Best-effort: a failed analytics insert must never break the caller's flow
// or surface to the user.
export async function trackEvent(
  userId: string,
  eventName: TrackedEventName,
  properties?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("analytics_events").insert({
    user_id: userId,
    event_name: eventName,
    source: "mobile",
    properties: (properties as Json) ?? null,
  });
  if (error) console.error("[trackEvent] insert failed:", error.message);
}
