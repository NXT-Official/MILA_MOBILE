import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { env } from "@/constants/env";

import { createSupabaseFetch } from "./auth-fetch";
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
      // No `lock: processLock`, on purpose. The installed auth-js marks the
      // option @deprecated, says to drop it, and removes it in v3; its
      // migration note gives React Native's `processLock` as the example to
      // delete. The default lockless path already single-flights refreshes and
      // discards a refresh that races a sign-out. Passing the lock would also
      // opt into a legacy path with a 5 s acquire timeout, where calls issued
      // alongside a slow refresh can reject with ProcessLockAcquireTimeoutError.
      // What a lock used to protect here, the chunked session in SecureStore,
      // is ordered and atomic inside `supabaseStorage` itself.
      // `auth-session-lockless-test` pins this against the installed library.
      // src: node_modules/@supabase/auth-js/migrations/lockless-coordination.md ("Migration steps") · 2.112.2
      // src: node_modules/@supabase/auth-js/dist/module/lib/locks.js `processLock`; GoTrueClient.js `_acquireLock` · 2.112.2
    },
    global: {
      // Auth requests get a deadline, and a refresh answered by a captive
      // portal, proxy or rate limit fails as a network error rather than
      // deleting her session. Everything else passes through untouched.
      fetch: createSupabaseFetch(env.SUPABASE_URL),
    },
  },
);

// Refresh only while foregrounded — a background timer drains battery and
// Android will kill it anyway.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
