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
  const recovery = useAuthStore((s) => s.recovery);
  const { data: profile, isPending, isError } = useProfile();

  const hasSession = Boolean(session);
  const profileSettled = !hasSession || !isPending;

  const destination = resolveDestination({
    hasSession,
    recovery,
    suspended: profile?.suspended === true,
    // Judge the profile she has. A failed refetch (every foreground makes one)
    // keeps the last good row in the cache, so `isError` alone says nothing
    // about whether she finished onboarding — treating it as incomplete sent a
    // member who had to a screen she was stuck on. Only an error with no row at
    // all has nothing to judge; that falls through as incomplete so onboarding
    // can re-fetch and recover rather than strand her on a blank screen.
    profileComplete: isError && !profile ? false : isStyleProfileComplete(toStyleProfileRow(profile)),
  });

  return { ready: !authLoading && profileSettled, destination };
}
