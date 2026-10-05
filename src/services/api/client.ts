import { env } from "@/constants/env";
import { supabase } from "@/services/supabase/client";

import { ApiError } from "./errors";

const BASE = env.API_BASE_URL;

/**
 * The error taxonomy lives in `./errors` — a leaf module with no imports, so it
 * is testable without the four `EXPO_PUBLIC_*` values this file requires at
 * import time. Re-exported here because every existing caller reaches for it
 * through the client.
 */
export {
  ApiError,
  NON_RETRYABLE_CODES,
  formatRetryAfter,
  isInsufficientCredits,
  isRateLimited,
  isSuspended,
  resolveApiFailure,
  type ApiFailure,
  type FailureKind,
} from "./errors";

type RequestInit = {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  retryOn401?: boolean;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { method = "POST", body, timeoutMs = 30_000, retryOn401 = true } = init;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // A timeout arrives here as an abort, indistinguishable from a dead socket
    // unless the signal is checked. They need different copy: "check your
    // connection" is wrong and slightly insulting when the request was fine and
    // the model was simply slow — which, at a 90s image budget, is the common case.
    if (controller.signal.aborted) {
      throw new ApiError("TIMEOUT", "That took longer than expected.", 0);
    }
    throw new ApiError("NETWORK", "Mila couldn't reach the studio. Check your connection.", 0);
  } finally {
    clearTimeout(timer);
  }

  // One refresh attempt, then give up — a refresh loop on an expired refresh
  // token is how an app ends up hammering auth while showing a blank screen.
  if (res.status === 401 && retryOn401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session) return request<T>(path, { ...init, retryOn401: false });
  }

  // Cloudflare (524) and generic proxy (504) timeouts arrive as HTML, not JSON.
  // Map them to TIMEOUT so the UI shows "took longer than expected" rather than
  // a misleading "something went wrong".
  if (res.status === 524 || res.status === 504) {
    throw new ApiError("TIMEOUT", "That took longer than expected.", res.status);
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(
      payload?.error?.code ?? "INTERNAL",
      payload?.error?.message ?? "Something went wrong.",
      res.status,
      payload?.error?.retryAfter,
    );
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string, o?: { timeoutMs?: number }) => request<T>(p, { ...o, method: "GET" }),
  post: <T>(p: string, body?: unknown, o?: { timeoutMs?: number }) =>
    request<T>(p, { ...o, method: "POST", body }),
};

/**
 * Per-endpoint timeouts. The image call alone budgets 75s server-side, so a 30s
 * default would abort a request that was going to succeed.
 *
 * `generateLook` covers two sequential deepseek calls server-side (inventory
 * review, then outfit plan), each bounded at 75s — 150s worst case, so the old
 * 120s budget could abort a generation that was going to succeed.
 *
 * `lookVisual` covers the style-sheet and photo-preview pipelines, which retry
 * a failed QA check up to 3 times before answering — a single attempt already
 * budgets 75s provider-side, so the 90s `lookImage` budget would abort retries
 * that were going to succeed. Worst case is ~3 × (render + QA) plus overhead;
 * 300s is that ceiling with headroom, and a partial result still comes back
 * well before it in every ordinary case.
 *
 * Every single-AI-call endpoint (`analysis`, `concierge`) sits on a 75s
 * provider budget server-side, so a 45–60s client budget aborts calls the
 * server was about to answer — and on the credit-charging ones the abort is
 * seen while the server may still complete and bill. 120s clears the server's
 * ceiling with room for the round trip.
 *
 * `personalColor` covers the two-pass colour read (calibration, then the season
 * call), each bounded at 75s server-side — 150s worst case, so the 120s
 * `analysis` budget would abort a read that was going to succeed. 180s clears
 * it; a read that fails refunds server-side, but only if it fails rather than
 * aborts.
 */
export const TIMEOUTS = {
  default: 30_000,
  // The compose call runs two sequential server-side AI stages, each bounded
  // at 110s (MILA's ai.server.ts), plus the inventory load — a worst case of
  // ~225s. This must sit above that, or a paid generation completes after
  // the client already gave up (and the credit with it).
  generateLook: 240_000,
  lookImage: 90_000,
  lookVisual: 300_000,
  analysis: 120_000,
  concierge: 120_000,
  personalColor: 180_000,
} as const;
