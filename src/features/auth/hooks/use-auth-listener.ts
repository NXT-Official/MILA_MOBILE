import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { restoreSession } from "@/services/api/auth";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useOnboardingStore } from "@/stores/onboarding-store";

/** Launch retries back off from 1 s and cap here; a return to the app retries at once. */
const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * Mirrors Supabase's session into the store and keeps the query cache honest.
 *
 * Mounted once, in the root layout. `restoreSession()` resolves the persisted
 * session from SecureStore at boot; the listener handles every change after.
 *
 * Until the boot read gives a definite answer the store stays `loading`, so the
 * launch gate holds the splash rather than guessing. A stored session that
 * needed a refresh while the network was down is not an answer: auth-js keeps
 * it on the device and the next attempt (or its own background refresh, which
 * arrives here as TOKEN_REFRESHED) brings her straight back in. Routing that
 * moment to login is what used to sign members out in a lift.
 */
export function useAuthListener() {
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let settled = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const settle = (session: Session | null) => {
      settled = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      setSession(session);
    };

    const restore = async () => {
      retryTimer = null;
      const result = await restoreSession();
      // An auth event may have answered the question while this read was out.
      if (!active || settled) return;
      if (result.status === "resolved") {
        settle(result.session);
        return;
      }
      const delay = Math.min(FIRST_RETRY_MS * 2 ** attempt, MAX_RETRY_MS);
      attempt += 1;
      retryTimer = setTimeout(restore, delay);
    };

    void restore();

    // Back in the foreground with the launch still undecided (she unlocked the
    // phone, left the lift): try now rather than wait out the backoff.
    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active" || settled || !retryTimer) return;
      clearTimeout(retryTimer);
      attempt = 0;
      void restore();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION reports the same read `restoreSession()` makes,
      // including the `null` a dropped connection produces. The launch decision
      // has exactly one owner, and it is `restore` above.
      // src: node_modules/@supabase/auth-js/dist/module/GoTrueClient.js `_emitInitialSession` · 2.112.2
      if (event === "INITIAL_SESSION") return;

      settle(session);
      if (event === "SIGNED_OUT") {
        // Never let one member's cached profile survive into another's session.
        queryClient.clear();
        // Nor her onboarding draft: a pending answer left in AsyncStorage would
        // replay into whoever signs in next, writing her body type to a
        // stranger's profile.
        useOnboardingStore.getState().reset();
      }
    });

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      appState.remove();
      subscription.subscription.unsubscribe();
    };
  }, [setSession, queryClient]);
}
