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
 * `session_not_found`, `session_expired`, `user_banned`, legacy
 * `invalid_grant`) still signs her out. On the refresh only, two answers the
 * auth server does send are not revocations and are treated as a network
 * error too (see `isNotARevocation`).
 *
 * Every auth request gets a deadline, because React Native's fetch sets none:
 * on Android a stalled request otherwise never finishes (a refresh that
 * single-flights every later attempt onto it, a sign-out button that spins
 * for good). The body is read inside the deadline too, so a reply that stalls
 * mid-body is cut off as well. An abort is a thrown fetch, which auth-js
 * classes as retryable.
 * - Short (AUTH_REQUEST_TIMEOUT_MS) where sending again is harmless: the
 *   refresh, reads, and sign-out (idempotent; auth-js signs her out on this
 *   phone when the request fails, GoTrueClient `_signOut`).
 * - Long (AUTH_WRITE_TIMEOUT_MS) for a sign-in, sign-up, reset email, one-time
 *   code, code exchange or account update: each is sent once and may already
 *   have taken effect (a session made, an email sent, a single-use captcha or
 *   code spent), so it is cut off only when it is clearly never coming back.
 */
type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Long enough for a slow cellular refresh; short enough that a stall is retried. */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

/**
 * For requests with a side effect: far beyond any legitimate wait, so a slow
 * request still completes, while a dead one still ends.
 */
export const AUTH_WRITE_TIMEOUT_MS = 60_000;

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

/**
 * Refresh answers from the auth server that say nothing about her refresh
 * token: 409 `conflict` (another refresh of the same session still holds its
 * row lock past GoTrue's own retry loop) and any `hook_*` code (a custom
 * access-token hook timed out or misbehaved). auth-js would delete the session
 * for both. Grounded in supabase/auth `internal/tokens/service.go`
 * (`RefreshTokenGrant`) and `internal/hooks` via re-review 2, R4.
 */
function isNotARevocation(status: number, data: unknown): boolean {
  if (status === 409) return true;
  if (!isRecord(data)) return false;
  const code = typeof data.code === "string" ? data.code : data.error_code;
  return typeof code === "string" && (code === "conflict" || code.startsWith("hook_"));
}

/** Whether a `/token` reply came from the auth server (see the file comment). */
function isFromAuthServer(status: number, body: string, isRefresh: boolean): boolean {
  if (NOT_FROM_AUTH_SERVER.has(status)) return false;
  const data = parseJson(body);
  if (data === undefined) return false;
  if (status >= 200 && status < 300) return isSession(data);
  if (isRefresh && isNotARevocation(status, data)) return false;
  return RETRIED_BY_AUTH_JS.has(status) || isAuthServerError(data);
}

export function createSupabaseFetch(
  supabaseUrl: string,
  options: { baseFetch?: Fetch; timeoutMs?: number; writeTimeoutMs?: number } = {},
): Fetch {
  // Resolved at call time, as supabase-js does with no custom fetch.
  const baseFetch: Fetch = options.baseFetch ?? ((input, init) => globalThis.fetch(input, init));
  const timeoutMs = options.timeoutMs ?? AUTH_REQUEST_TIMEOUT_MS;
  const writeTimeoutMs = options.writeTimeoutMs ?? AUTH_WRITE_TIMEOUT_MS;
  // supabase-js builds the auth URL the same way: `new URL("auth/v1", base/)`.
  const base = supabaseUrl.trim().endsWith("/") ? supabaseUrl.trim() : `${supabaseUrl.trim()}/`;
  const authPrefix = new URL("auth/v1/", base).href;
  const tokenUrl = `${authPrefix}token`;
  const logoutUrl = `${authPrefix}logout`;

  return async (input, init) => {
    const url = requestUrl(input);
    if (url === null || !url.startsWith(authPrefix)) return baseFetch(input, init);
    const isTokenRequest = url === tokenUrl || url.startsWith(`${tokenUrl}?`);
    const isRefresh = isTokenRequest && new URL(url).searchParams.get("grant_type") === "refresh_token";
    const isRead = (init?.method ?? "GET").toUpperCase() === "GET";
    const isSignOut = url === logoutUrl || url.startsWith(`${logoutUrl}?`);

    const controller = new AbortController();
    const deadline = isRefresh || isRead || isSignOut ? timeoutMs : writeTimeoutMs;
    const timer = setTimeout(() => controller.abort(), deadline);
    const callerSignal = init?.signal ?? null;
    const forwardAbort = () => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener("abort", forwardAbort);

    try {
      const response = await baseFetch(input, { ...init, signal: controller.signal });
      const body = await response.text();

      if (isTokenRequest && !isFromAuthServer(response.status, body, isRefresh)) {
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
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", forwardAbort);
    }
  };
}
