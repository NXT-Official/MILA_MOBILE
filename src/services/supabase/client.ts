import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { env } from "@/constants/env";

import { supabaseStorage } from "./auth-storage";
import type { Database } from "./types";

// supabase-js constructs its realtime client eagerly, and realtime-js throws
// at construction when the runtime exposes no WebSocket constructor — which is
// exactly the web export's static-render sandbox (it has `process`, not
// `WebSocket`). The app never opens a realtime channel (no `.channel(` or
// `.subscribe(` callers anywhere), so stand one in that fails only if
// something ever tries to connect. Shipped platforms (Android, iOS) and real
// browsers all define WebSocket, so this is a no-op there.
if (typeof globalThis.WebSocket === "undefined") {
  Object.defineProperty(globalThis, "WebSocket", {
    value: class WebSocket {
      constructor() {
        throw new Error("Realtime channels are not supported in this environment.");
      }
    },
    configurable: true,
    writable: true,
  });
}

export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: supabaseStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // no browser URL to parse
      // No `lock: processLock`, on purpose. In the installed auth-js the
      // option is @deprecated and opts into a legacy path that wraps every auth
      // call in a lock with a 5 s acquire timeout: a refresh slower than that
      // on a weak connection makes every concurrent getSession() (one per API
      // request) reject. The default lockless path already single-flights
      // refreshes and discards a refresh that races a sign-out. What a lock
      // used to protect here, the chunked session in SecureStore, is now
      // ordered and atomic inside `supabaseStorage` itself.
      // `auth-session-lockless-test` pins this against the installed library.
      // src: node_modules/@supabase/auth-js/migrations/lockless-coordination.md · 2.112.2
      // src: node_modules/@supabase/auth-js/dist/module/lib/locks.js `processLock` · 2.112.2
    },
  },
);

// Refresh only while foregrounded — a background timer drains battery and
// Android will kill it anyway.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
