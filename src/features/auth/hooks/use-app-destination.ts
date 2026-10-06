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
 *
 * Settled means READ. A profile read that failed with no row to judge
 * (network, timeout, server error) is not an answer about her profile, so it
 * never routes anyone to onboarding: `ready` stays false, the gate keeps
 * holding, and its holding view offers Try again (`use-launch-hold`).
 * Onboarding is only for a profile that was read and is genuinely incomplete.
 * Owner ruling, 2026-10-07: a finished member sent back through onboarding
 * reads as her answers having been lost.
 */
export function useAppDestination(): { ready: boolean; destination: Destination } {
  const session = useAuthStore((s) => s.session);
  const authLoading = useAuthStore((s) => s.loading);
  const recovery = useAuthStore((s) => s.recovery);
  const { data: profile, isPending, isError } = useProfile();

  const hasSession = Boolean(session);
  const profileReadFailed = hasSession && isError && !profile;
  const profileSettled = !hasSession || (!isPending && !profileReadFailed);

  const destination = resolveDestination({
    hasSession,
    recovery,
    suspended: profile?.suspended === true,
    // Judge the profile she has. A failed refetch (every foreground makes one)
    // keeps the last good row in the cache, so `isError` alone says nothing
    // about whether she finished onboarding — treating it as incomplete sent a
    // member who had to a screen she was stuck on. An error with no row at all
    // has nothing to judge, and is held above (`profileReadFailed`) rather than
    // read as incomplete.
    profileComplete: isStyleProfileComplete(toStyleProfileRow(profile)),
  });

  return { ready: !authLoading && profileSettled, destination };
}
