import type { Json } from "@/types/models";

import { capturePhEvent, identifyPhUser } from "@/services/posthog";
import { supabase } from "./client";

/**
 * Product analytics. Direct through RLS (§7): no secret, no credit, and no
 * permission the database cannot express — insert-only, own user_id, same
 * shape as saved_palettes.
 *
 * Events land in two places: the `analytics_events` table (in-app reporting)
 * and PostHog (product analytics) — the same two-place contract as the web
 * app's trackEvent.
 */
export type TrackedEventName =
  | "signup_completed"
  | "onboarding_completed"
  | "look_generated"
  | "purchase_started";

// Best-effort: a failed analytics write must never break the caller's flow
// or surface to the user.
export async function trackEvent(
  userId: string,
  eventName: TrackedEventName,
  properties?: Record<string, unknown>,
): Promise<void> {
  // PostHog mirror first — it must not wait on the database round-trip.
  // identify() re-asserts the distinct id because signup events fire before
  // the auth listener's own identify has necessarily run.
  identifyPhUser(userId);
  capturePhEvent(eventName, { ...(properties ?? {}), source: "mobile" });

  const { error } = await supabase.from("analytics_events").insert({
    user_id: userId,
    event_name: eventName,
    source: "mobile",
    properties: (properties as Json) ?? null,
  });
  if (error) console.error("[trackEvent] insert failed:", error.message);
}
