import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { signOut } from "@/services/api/auth";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Sign out: end the session, clear the cache, return to login (§5).
 *
 * Lives in `hooks/` rather than beside the auth screens because Settings signs
 * out too, and a feature may never import another feature's internals (§5).
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const setSigningOut = useAuthStore((s) => s.setSigningOut);

  return useMutation({
    retry: false,
    mutationFn: async () => {
      setSigningOut(true);
      await signOut();
    },
    onSettled: () => {
      // Clear before navigating: a stale profile in the cache would let the
      // next member briefly see the previous one's gate result.
      queryClient.clear();
      setSigningOut(false);
      router.replace("/login");
    },
  });
}
