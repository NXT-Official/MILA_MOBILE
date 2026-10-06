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
 * A JSON reply is no proof either: a 200 without a session becomes
 * `AuthSessionMissingError`, and the Supabase gateway's 401 "Invalid API key"
 * or a firewall's JSON 403 becomes a fatal `AuthApiError`, and each deleted it.
 * src: node_modules/@supabase/auth-js/dist/module/lib/fetch.js `hasSession` · 2.112.2
 *
 * So on a `/token` request only two kinds of reply reach auth-js: a session,
 * and an error in the auth server's own shape (see `isAuthServerError`).
 * Anything else becomes a thrown TypeError, the shape of a network failure, so
 * auth-js keeps the session and retries. A revoked refresh token
 * (`refresh_token_not_found`, `refresh_token_already_used`,
 * `session_not_found`, legacy `invalid_grant`) still signs her out.
 *
 * Requests that are safe to send again (the refresh, and reads) also get a
 * deadline. React Native's fetch sets no timeout, so a stalled connection can
 * hold a refresh open for minutes, and while it hangs auth-js single-flights
 * every later attempt onto it. The body is read inside the deadline too, so a
 * reply that stalls mid-body is cut off as well. An abort is a thrown fetch,
 * which auth-js classes as retryable. A sign-in, sign-up, reset email, code
 * exchange or account update is sent once and may already have taken effect
 * (a session made, an email sent, a single-use captcha or code spent), so it is
 * never cut off.
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

/**
 * Server and gateway failures auth-js already retries, whatever the body.
 * src: node_modules/@supabase/auth-js/dist/module/lib/fetch.js `NETWORK_ERROR_CODES` · 2.112.2
 */
const RETRIED_BY_AUTH_JS = new Set([
  500, 501, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530,
]);

/** Auth error codes are snake_case (`refresh_token_not_found`, `invalid_grant`). */
const AUTH_ERROR_CODE = /^[a-z][a-z0-9_]*$/;

function requestUrl(input: RequestInfo | URL): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return typeof input?.url === "string" ? input.url : null;
}

/** The parsed body, or `undefined` when it is not JSON. */
function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The session shape auth-js accepts from `/token`.
 * src: node_modules/@supabase/auth-js/dist/module/lib/fetch.js `hasSession` · 2.112.2
 */
function isSession(data: unknown): boolean {
  return isRecord(data) && !!data.access_token && !!data.refresh_token && !!data.expires_in;
}

/**
 * An error in one of the auth server's own shapes. auth-js reads a string
 * `code` (current API, which it asks for on every request) or a string
 * `error_code` (older bodies); the OAuth form pairs `error` with
 * `error_description`. A gateway's `{"message": ...}` or a firewall's
 * `{"error":"Forbidden"}` carries none of these. Codes are checked by shape,
 * not against a list: auth-js notes the server may send codes newer than its
 * own list (`lib/error-codes.d.ts`).
 * src: node_modules/@supabase/auth-js/dist/module/lib/fetch.js `handleError`; lib/error-codes.d.ts `ErrorCode` · 2.112.2
 */
function isAuthServerError(data: unknown): boolean {
  if (!isRecord(data)) return false;
  if (typeof data.error_code === "string" && AUTH_ERROR_CODE.test(data.error_code)) return true;
  if (typeof data.code === "string" && AUTH_ERROR_CODE.test(data.code)) return true;
  return (
    typeof data.error === "string" &&
    AUTH_ERROR_CODE.test(data.error) &&
    typeof data.error_description === "string"
  );
}

/** Whether a `/token` reply came from the auth server (see the file comment). */
function isFromAuthServer(status: number, body: string): boolean {
  if (NOT_FROM_AUTH_SERVER.has(status)) return false;
  const data = parseJson(body);
  if (data === undefined) return false;
  if (status >= 200 && status < 300) return isSession(data);
  return RETRIED_BY_AUTH_JS.has(status) || isAuthServerError(data);
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
    const isRefresh = isTokenRequest && new URL(url).searchParams.get("grant_type") === "refresh_token";
    const isRead = (init?.method ?? "GET").toUpperCase() === "GET";

    const controller = new AbortController();
    const timer = isRefresh || isRead ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const callerSignal = init?.signal ?? null;
    const forwardAbort = () => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener("abort", forwardAbort);

    try {
      const response = await baseFetch(input, { ...init, signal: controller.signal });
      const body = await response.text();

      if (isTokenRequest && !isFromAuthServer(response.status, body)) {
        throw new TypeError(
          `Network request failed: the sign-in request was answered by something other than the auth server (HTTP ${response.status}).`,
        );
      }

      return new Response(NULL_BODY_STATUSES.has(response.status) || body === "" ? null : body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      if (timer !== null) clearTimeout(timer);
      callerSignal?.removeEventListener("abort", forwardAbort);
    }
  };
}
