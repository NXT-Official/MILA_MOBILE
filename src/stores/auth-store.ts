import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

/**
 * A thin mirror of the Supabase auth listener — not a user model.
 *
 * SecureStore owns the session; this store exists so React can re-render on a
 * session change. The profile belongs to TanStack Query, so there is no user
 * slice here to drift from the server.
 */
type AuthState = {
  session: Session | null;
  /**
   * True until the startup restore gives a definite answer (`use-auth-listener`)
   * — the splash waits on this.
   */
  loading: boolean;
  /**
   * Latched by the reset-password screen when it recognises a recovery deep
   * link, before `setSession` runs — see `resolveDestination`. Cleared once
   * the new password is saved (or the member backs out), letting the launch
   * gate resolve normally again.
   */
  recovery: boolean;
  /**
   * The launch gate has held for a few seconds without being ready (no
   * connection, a captive portal, a profile request that never answers). The
   * gate lifts the splash and shows the offline holding view instead of a
   * splash that never moves. Owned by `use-launch-hold`, which clears it the
   * moment the gate is ready.
   */
  launchStalled: boolean;
  /** A startup restore attempt is out right now; "Try again" shows it as busy. */
  launchAttempting: boolean;
  /** Bumped by "Try again"; the auth listener starts an attempt when it changes. */
  launchRetryRequests: number;
  setSession: (session: Session | null) => void;
  setRecovery: (recovery: boolean) => void;
  setLaunchStalled: (stalled: boolean) => void;
  setLaunchAttempting: (attempting: boolean) => void;
  requestLaunchRetry: () => void;
  /**
   * "Sign in again" from the holding view: open login now, WITHOUT touching
   * the session stored on this phone. The listener keeps restoring in the
   * background, so a later success still opens the app; a sign-in replaces it.
   */
  signInWhileRestoring: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,
  recovery: false,
  launchStalled: false,
  launchAttempting: false,
  launchRetryRequests: 0,
  // Leaves `launchStalled` to the gate: a restore that lands while her
  // profile is still on its way must not drop the holding view into a bare
  // spinner (use-launch-hold).
  setSession: (session) => set({ session, loading: false }),
  setRecovery: (recovery) => set({ recovery }),
  setLaunchStalled: (launchStalled) => set({ launchStalled }),
  setLaunchAttempting: (launchAttempting) => set({ launchAttempting }),
  requestLaunchRetry: () => set((s) => ({ launchRetryRequests: s.launchRetryRequests + 1 })),
  signInWhileRestoring: () => set({ session: null, loading: false, launchStalled: false }),
}));

export const useSession = () => useAuthStore((s) => s.session);
export const useUserId = () => useAuthStore((s) => s.session?.user.id ?? null);
