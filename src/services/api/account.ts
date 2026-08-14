import { api, TIMEOUTS } from "./client";

/**
 * `POST /account/delete` — irreversible, and deliberately server-side.
 *
 * It cancels billing immediately, purges storage, deletes the auth user, and
 * lets the schema cascade every row. None of that can happen from the client:
 * deleting an auth user needs the service role, and cancelling a subscription
 * needs the Paddle key. Both stay on the server (§10).
 *
 * The `email` field is the confirmation the member typed. The server re-checks
 * it against the session's own address — the client-side comparison is UX, and
 * the server's is the one that counts.
 */
export function deleteAccount(email: string): Promise<{ success: true }> {
  return api.post<{ success: true }>("/account/delete", { email }, {
    // Longer than the default: this fans out to Paddle, storage, and auth
    // before it answers, and a timeout here would leave a member unsure
    // whether her account is gone.
    timeoutMs: TIMEOUTS.generateLook,
  });
}
