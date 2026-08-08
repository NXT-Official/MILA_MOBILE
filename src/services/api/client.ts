import { env } from "@/constants/env";
import { supabase } from "@/services/supabase/client";

const BASE = env.API_BASE_URL;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The single most important code in the app — it is the paywall trigger and the
 * primary conversion moment. Map it explicitly; never let it fall into a
 * generic handler.
 */
export const isInsufficientCredits = (e: unknown) =>
  e instanceof ApiError && e.code === "INSUFFICIENT_CREDITS";

export const isRateLimited = (e: unknown) => e instanceof ApiError && e.code === "RATE_LIMITED";

export const isSuspended = (e: unknown) =>
  e instanceof ApiError && e.code === "ACCOUNT_SUSPENDED";

/** Retrying any of these is always wrong. */
export const NON_RETRYABLE_CODES = [
  "INSUFFICIENT_CREDITS",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "ACCOUNT_SUSPENDED",
  "VALIDATION_FAILED",
] as const;

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
 */
export const TIMEOUTS = {
  default: 30_000,
  generateLook: 60_000,
  lookImage: 90_000,
  analysis: 60_000,
  concierge: 45_000,
} as const;
