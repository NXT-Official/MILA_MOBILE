import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Mirrors Supabase's session into the store and keeps the query cache honest.
 *
 * Mounted once, in the root layout. `getSession()` resolves the persisted
 * session from SecureStore at boot; the listener handles every change after.
 */
export function useAuthListener() {
  const setSession = useAuthStore((s) => s.setSession);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Never let one member's cached profile survive into another's session.
      if (event === "SIGNED_OUT") queryClient.clear();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [setSession, queryClient]);
}
