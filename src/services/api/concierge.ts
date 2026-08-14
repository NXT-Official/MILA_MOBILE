import type { ChatTurn } from "@/lib/concierge-history";

import { api, TIMEOUTS } from "./client";

/**
 * `POST /concierge/chat` — **1 credit**, 20 per 5 minutes, both metered
 * server-side (§6).
 *
 * The endpoint returns a reply and **does not write history**. Persisting both
 * sides of the turn is the client's job, exactly as on the web — see
 * `services/supabase/concierge.ts`.
 *
 * No prompt, no system message, no model name, and no schema lives in this
 * repo. The server reads her dossier, attaches the anchored look's image, and
 * composes the request; this file sends typed input and receives typed output.
 */
export type ConciergeChatInput = {
  message: string;
  /** Already trimmed to 12 turns / 6000 characters by `toHistory`. */
  history: ChatTurn[];
  /** The server re-reads the look scoped to the caller; a 404 refunds the credit. */
  lookId?: string | null;
  /**
   * Supported by the contract, unused by this phase's UI. Any URL sent here
   * must already be a Mila storage URL — the server rejects anything else, and
   * that check is the SSRF defence (§8).
   */
  imageUrl?: string | null;
};

export function conciergeChat(input: ConciergeChatInput): Promise<{ reply: string }> {
  return api.post<{ reply: string }>("/concierge/chat", input, {
    timeoutMs: TIMEOUTS.concierge,
  });
}
