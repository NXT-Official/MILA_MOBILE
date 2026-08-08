import { useQuery } from "@tanstack/react-query";

import { isStyleProfileComplete } from "@/lib/style-profile/completion";
import { supabase } from "@/services/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { PROFILE_GATE_COLUMNS, type Profile } from "@/types/models";

// The decision itself is pure and lives in lib/ so a unit test can import it
// without pulling in the Supabase client.
import { resolveDestination, type Destination } from "@/lib/auth-destination";

export { resolveDestination, type Destination };

/** Reads the gate columns for the signed-in member. Null while signed out. */
export function useGateProfile() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_GATE_COLUMNS)
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });
}

/**
 * Resolves where the app should be. `ready` is false until both the session and
 * (when signed in) the profile have settled — the splash stays up until then so
 * no guard redirect is ever visible.
 */
export function useAppDestination(): { ready: boolean; destination: Destination } {
  const session = useAuthStore((s) => s.session);
  const authLoading = useAuthStore((s) => s.loading);
  const { data: profile, isPending, isError } = useGateProfile();

  const hasSession = Boolean(session);
  const profileSettled = !hasSession || (!isPending && true);

  const destination = resolveDestination({
    hasSession,
    suspended: profile?.suspended === true,
    // A failed profile read must not strand her on a blank screen; treat it as
    // incomplete so onboarding can re-fetch and recover.
    profileComplete: isError ? false : isStyleProfileComplete(profile),
  });

  return { ready: !authLoading && profileSettled, destination };
}
