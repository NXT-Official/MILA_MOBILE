import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { restoreSession } from "@/services/api/auth";
import { identifyPhUser, resetPh } from "@/services/posthog";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useOnboardingStore } from "@/stores/onboarding-store";

/** Launch retries back off from 1 s and cap here; a return to the app retries at once. */
const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
/**
 * Failed secure-store reads in a row, with the app open, before login is shown
 * while the restore keeps trying. A network failure never counts: it retries
 * for as long as it lasts.
 */
const MAX_UNREADABLE_READS = 3;

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
 *
 * The one exception is a secure store that cannot be read at all (a keystore
 * entry that does not decrypt, often only for a few seconds after a reboot).
 * Holding the splash on that would trap her, so after MAX_UNREADABLE_READS
 * failures in a row while the app is open she is shown login, exactly as the
 * holding view's "Sign in again" does: nothing is deleted and this loop keeps
 * restoring at its backoff, so a keystore that recovers still opens the app,
 * and a sign-in in the meantime replaces the entry (`auth-storage.ts` writes
 * over a header it cannot read). Failures while the app is in the background
 * do not count, as iOS refuses keychain reads on a locked phone.
 *
 * The holding view itself is armed by the launch gate (`use-launch-hold`) for
 * any time the launch is not ready. Its "Try again" (`requestLaunchRetry`)
 * starts an attempt here; its "Sign in again" (`signInWhileRestoring`) opens
 * login while this loop keeps restoring, so a later success still opens the
 * app.
 *
 * Product analytics rides the same event stream: the member is identified as
 * soon as a session exists, and the identity is cleared on sign-out so the
 * next visitor starts anonymous — the web app's AuthProvider contract.
 */
export function useAuthListener() {
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let settled = false;
    let attempt = 0;
    let unreadableReads = 0;
    let inFlight = false;
    let rerunWhenDone = false;
    let handedToLogin = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const launch = useAuthStore.getState();

    const settle = (session: Session | null) => {
      settled = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      setSession(session);
      // Product analytics: identify the member as soon as a session exists.
      if (session?.user.id) identifyPhUser(session.user.id);
    };

    const restore = async () => {
      retryTimer = null;
      inFlight = true;
      launch.setLaunchAttempting(true);
      const result = await restoreSession();
      inFlight = false;
      if (active) launch.setLaunchAttempting(false);
      // An auth event may have answered the question while this read was out.
      if (!active || settled) return;
      if (result.status === "resolved") {
        settle(result.session);
        return;
      }

      if (result.reason === "unreadable") {
        if (AppState.currentState === "active") unreadableReads += 1;
      } else {
        unreadableReads = 0;
      }
      if (unreadableReads >= MAX_UNREADABLE_READS && !handedToLogin) {
        // Login now, without deleting anything, and keep restoring below.
        handedToLogin = true;
        launch.signInWhileRestoring();
      }

      if (rerunWhenDone) {
        // She came back while this attempt was out: start a fresh one now.
        rerunWhenDone = false;
        void restore();
        return;
      }
      const delay = Math.min(FIRST_RETRY_MS * 2 ** attempt, MAX_RETRY_MS);
      attempt += 1;
      retryTimer = setTimeout(restore, delay);
    };

    void restore();

    // Try now rather than wait out the backoff. If an attempt is still out, a
    // fresh one follows the moment it ends, never two at once. Auth requests
    // carry a deadline (`auth-fetch.ts`), so it ends.
    const tryNow = () => {
      if (settled) return;
      attempt = 0;
      if (inFlight) {
        rerunWhenDone = true;
        return;
      }
      if (retryTimer) clearTimeout(retryTimer);
      void restore();
    };

    // Back in the foreground with the launch still undecided (she unlocked the
    // phone, left the lift).
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") tryNow();
    });

    // "Try again" on the offline holding view.
    const unsubscribeRetry = useAuthStore.subscribe((state, previous) => {
      if (state.launchRetryRequests !== previous.launchRetryRequests) tryNow();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION reports the same read `restoreSession()` makes,
      // including the `null` a dropped connection produces. The launch decision
      // has exactly one owner, and it is `restore` above.
      // src: node_modules/@supabase/auth-js/dist/module/GoTrueClient.js `_emitInitialSession` · 2.112.2
      if (event === "INITIAL_SESSION") return;

      settle(session);
      if (event === "SIGNED_OUT") {
        // Never let one member's analytics identity, cached profile, or
        // onboarding draft survive into another's session.
        resetPh();
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
      if (inFlight) launch.setLaunchAttempting(false);
      unsubscribeRetry();
      appState.remove();
      subscription.subscription.unsubscribe();
    };
  }, [setSession, queryClient]);
}
