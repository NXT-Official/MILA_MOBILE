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
  /** True until the first `getSession()` resolves — the splash waits on this. */
  loading: boolean;
  /**
   * Latched by the reset-password screen when it recognises a recovery deep
   * link, before `setSession` runs — see `resolveDestination`. Cleared once
   * the new password is saved (or the member backs out), letting the launch
   * gate resolve normally again.
   */
  recovery: boolean;
  setSession: (session: Session | null) => void;
  setRecovery: (recovery: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,
  recovery: false,
  setSession: (session) => set({ session, loading: false }),
  setRecovery: (recovery) => set({ recovery }),
}));

export const useSession = () => useAuthStore((s) => s.session);
export const useUserId = () => useAuthStore((s) => s.session?.user.id ?? null);
