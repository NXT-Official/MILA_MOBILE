import { useProfile } from "@/hooks/use-profile";
import { isStyleProfileComplete, toStyleProfileRow } from "@/lib/style-profile/completion";
import { useAuthStore } from "@/stores/auth-store";

// The decision itself is pure and lives in lib/ so a unit test can import it
// without pulling in the Supabase client.
import { resolveDestination, type Destination } from "@/lib/auth-destination";

export { resolveDestination, type Destination };

/**
 * Resolves where the app should be. `ready` is false until both the session and
 * (when signed in) the profile have settled — the splash stays up until then so
 * no guard redirect is ever visible.
 */
export function useAppDestination(): { ready: boolean; destination: Destination } {
  const session = useAuthStore((s) => s.session);
  const authLoading = useAuthStore((s) => s.loading);
  const { data: profile, isPending, isError } = useProfile();

  const hasSession = Boolean(session);
  const profileSettled = !hasSession || !isPending;

  const destination = resolveDestination({
    hasSession,
    suspended: profile?.suspended === true,
    // A failed profile read must not strand her on a blank screen; treat it as
    // incomplete so onboarding can re-fetch and recover.
    profileComplete: isError ? false : isStyleProfileComplete(toStyleProfileRow(profile)),
  });

  return { ready: !authLoading && profileSettled, destination };
}
