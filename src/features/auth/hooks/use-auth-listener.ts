import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { identifyPhUser, resetPh } from "@/services/posthog";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useOnboardingStore } from "@/stores/onboarding-store";

/**
 * Mirrors Supabase's session into the store and keeps the query cache honest.
 *
 * Mounted once, in the root layout. `getSession()` resolves the persisted
 * session from SecureStore at boot; the listener handles every change after.
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

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user.id) identifyPhUser(data.session.user.id);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user.id) identifyPhUser(session.user.id);
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
      subscription.subscription.unsubscribe();
    };
  }, [setSession, queryClient]);
}
