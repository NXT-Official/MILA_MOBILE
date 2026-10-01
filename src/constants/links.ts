import { env } from "./env";

/**
 * The web app's origin, derived from the configured API base URL.
 *
 * The API and the legal pages are one deployment — `/api/v1/*` is a route tree
 * inside the web app that also serves `/privacy` and `/terms`. Deriving the
 * origin from the same value the API uses keeps a single source of truth; a
 * hardcoded domain would point at nothing the first time the backend moved.
 */
function webOrigin(apiBaseUrl: string): string {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    // A malformed base URL already fails loudly at the first API call. This
    // only has to not crash a screen that renders a link.
    return apiBaseUrl.replace(/\/+$/, "");
  }
}

const ORIGIN = webOrigin(env.API_BASE_URL);

/** The signup notice's Privacy Policy link (a web route, opened in the browser). */
export const PRIVACY_POLICY_URL = `${ORIGIN}/privacy`;

/** The signup notice's Terms link (a web route, opened in the browser). */
export const TERMS_URL = `${ORIGIN}/terms`;
