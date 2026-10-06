/**
 * The fetch the Supabase client is given as `global.fetch`. supabase-js hands
 * the same function to the auth client and to PostgREST / storage, so this
 * changes auth requests only and passes everything else through untouched.
 * src: node_modules/@supabase/supabase-js/dist/index.mjs `_initSupabaseAuthClient` (`fetch: fetch$1`), `fetchWithAuth` · 2.112.2
 *
 * Why it exists: auth-js deletes the stored session when a refresh fails with
 * an error it does not class as retryable while the access token has already
 * expired (`_callRefreshToken` → `_removeSession`). A thrown fetch is
 * retryable; a non-JSON error body is retryable only for 500-504 and 520-530,
 * and becomes a fatal `AuthUnknownError` otherwise; a JSON 4xx becomes a fatal
 * `AuthApiError`. So a captive portal (hotel or airport Wi-Fi) answering 511 or
 * 403 with an HTML page, or a proxy answering 407 or 429, deleted the token
 * although the auth server never rejected it.
 * src: node_modules/@supabase/auth-js/dist/module/lib/fetch.js `_handleRequest`, `handleError`, `NETWORK_ERROR_CODES` · 2.112.2
 * src: node_modules/@supabase/auth-js/dist/module/GoTrueClient.js `_callRefreshToken` · 2.112.2
 *
 * On a `/token` request this turns those replies into a thrown TypeError, the
 * shape of a network failure, so auth-js keeps the session and retries. A real
 * auth-server answer (JSON, any other status) passes through unchanged: a
 * revoked refresh token (400 `refresh_token_not_found` / `invalid_grant`)
 * still signs her out.
 *
 * Every auth request also gets a deadline. React Native's fetch sets no
 * timeout, so a stalled connection can hold a refresh open for minutes, and
 * while it hangs auth-js single-flights every later attempt onto it. The body
 * is read inside the deadline too, so a reply that stalls mid-body is cut off
 * as well. An abort is a thrown fetch, which auth-js classes as retryable.
 */
type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Long enough for a slow cellular refresh; short enough that a stall is retried. */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Statuses only something in front of the auth server sends on a token
 * request: proxy authentication (407), a proxy timeout (408), a rate limit on
 * a shared carrier address (429) and a captive portal (511).
 */
const NOT_FROM_AUTH_SERVER = new Set([407, 408, 429, 511]);

/** A Response with one of these statuses may not carry a body. */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function requestUrl(input: RequestInfo | URL): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return typeof input?.url === "string" ? input.url : null;
}

function isJson(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

export function createSupabaseFetch(
  supabaseUrl: string,
  options: { baseFetch?: Fetch; timeoutMs?: number } = {},
): Fetch {
  // Resolved at call time, as supabase-js does with no custom fetch.
  const baseFetch: Fetch = options.baseFetch ?? ((input, init) => globalThis.fetch(input, init));
  const timeoutMs = options.timeoutMs ?? AUTH_REQUEST_TIMEOUT_MS;
  // supabase-js builds the auth URL the same way: `new URL("auth/v1", base/)`.
  const base = supabaseUrl.trim().endsWith("/") ? supabaseUrl.trim() : `${supabaseUrl.trim()}/`;
  const authPrefix = new URL("auth/v1/", base).href;
  const tokenUrl = `${authPrefix}token`;

  return async (input, init) => {
    const url = requestUrl(input);
    if (url === null || !url.startsWith(authPrefix)) return baseFetch(input, init);
    const isTokenRequest = url === tokenUrl || url.startsWith(`${tokenUrl}?`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const callerSignal = init?.signal ?? null;
    const forwardAbort = () => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener("abort", forwardAbort);

    try {
      const response = await baseFetch(input, { ...init, signal: controller.signal });
      const body = await response.text();

      if (isTokenRequest && (NOT_FROM_AUTH_SERVER.has(response.status) || !isJson(body))) {
        throw new TypeError(
          `Network request failed: the sign-in refresh was answered by something other than the auth server (HTTP ${response.status}).`,
        );
      }

      return new Response(NULL_BODY_STATUSES.has(response.status) || body === "" ? null : body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", forwardAbort);
    }
  };
}
