import { api } from "./client";

/** Existing web memberships remain managed by the server's Paddle integration. */
export function cancelMembership(): Promise<{ success: true; endsAt: string }> {
  return api.post("/billing/cancel");
}

export function resumeMembership(): Promise<{ success: true; renewsAt: string }> {
  return api.post("/billing/resume");
}
