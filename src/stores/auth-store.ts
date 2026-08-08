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
  /** Suppresses the guard redirect flash while a sign-out is in flight. */
  signingOut: boolean;
  setSession: (session: Session | null) => void;
  setSigningOut: (signingOut: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,
  signingOut: false,
  setSession: (session) => set({ session, loading: false }),
  setSigningOut: (signingOut) => set({ signingOut }),
}));

export const useSession = () => useAuthStore((s) => s.session);
export const useUserId = () => useAuthStore((s) => s.session?.user.id ?? null);
