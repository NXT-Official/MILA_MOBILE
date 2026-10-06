import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "@/constants/query-keys";
import { useAuthStore } from "@/stores/auth-store";

/**
 * How long the launch gate may hold before the offline holding view replaces
 * the splash. A healthy launch is ready well inside this.
 */
export const LAUNCH_STALL_MS = 5_000;

export type LaunchHold = {
  /** The gate has held for LAUNCH_STALL_MS: show the holding view. */
  stalled: boolean;
  /**
   * What it is waiting on. `session`: the startup restore (Try again and Sign
   * in again). `profile`: she is signed in and only her profile has not
   * arrived (Try again only; signing in again makes no sense).
   */
  stage: "session" | "profile";
  /** Profile stage: ask for her profile again now (Try again). */
  retryProfile: () => void;
  /** Profile stage: a profile read is out, so Try again shows as busy. */
  profileRetrying: boolean;
};

/**
 * The single owner of `launchStalled`, armed whenever the launch gate is
 * holding, whatever it waits on.
 *
 * It used to be armed only while the session restore was pending. With a
 * valid stored token the restore answers at once and the gate then waits on
 * her profile; on a stalled connection that read never answered and the
 * native splash stayed up for good (re-review N2). Armed here, one timer
 * covers the whole hold, and the view stays up without a gap when the restore
 * lands and the profile is still on its way.
 */
export function useLaunchHold(holding: boolean): LaunchHold {
  const launchStalled = useAuthStore((s) => s.launchStalled);
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const setLaunchStalled = useAuthStore((s) => s.setLaunchStalled);
  // The profile query is owned by `useProfile` (the gate's own observer);
  // this only asks it to run again and watches whether it is running, so no
  // second observer or foreground listener is added.
  const queryClient = useQueryClient();
  const profileKey = queryKeys.profile(userId ?? undefined);
  const profileRetrying = useIsFetching({ queryKey: profileKey }) > 0;

  useEffect(() => {
    if (!holding) {
      setLaunchStalled(false);
      return undefined;
    }
    const timer = setTimeout(() => setLaunchStalled(true), LAUNCH_STALL_MS);
    return () => clearTimeout(timer);
  }, [holding, setLaunchStalled]);

  return {
    stalled: holding && launchStalled,
    stage: userId ? "profile" : "session",
    // A refetch during a first load (no data yet) rejoins the stalled request
    // rather than replacing it, so cancel that one first: its abort signal
    // reaches `fetchProfile`, and the refetch then sends a fresh request.
    // src: node_modules/@tanstack/query-core/build/modern/query.js `fetch` (cancelRefetch only with data) · 5.101.4
    retryProfile: () => {
      void queryClient
        .cancelQueries({ queryKey: profileKey })
        .then(() => queryClient.refetchQueries({ queryKey: profileKey }));
    },
    profileRetrying,
  };
}
