import { useMutation } from "@tanstack/react-query";

import { signOut } from "@/services/api/auth";

/**
 * Sign out: end the session (§5).
 *
 * It does nothing else on purpose. Supabase's `SIGNED_OUT` event is what clears
 * the query cache and the onboarding draft (`use-auth-listener`), and the root
 * layout's `Stack.Protected` gate is what returns to `/login` once the session
 * is gone. Repeating either here gave a second owner: the old `router.replace`
 * fired even when `signOut()` had failed, pushing a member at a login route
 * whose guard was still closed while she was in fact still signed in.
 *
 * Lives in `hooks/` rather than beside the auth screens because Settings signs
 * out too, and a feature may never import another feature's internals (§5).
 */
export function useSignOut() {
  return useMutation({ mutationFn: signOut, retry: false });
}
