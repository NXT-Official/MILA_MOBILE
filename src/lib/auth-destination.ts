/**
 * Real URLs, not group paths. Route groups — `(auth)`, `(tabs)` — do not appear
 * in the URL, so §4's `/(auth)/login` and `/(tabs)` literals do not type-check
 * under `experiments.typedRoutes`. The tabs index resolves to `/`.
 */
export type Destination = "/login" | "/suspended" | "/onboarding/welcome" | "/";

/**
 * The single launch decision, mirroring the web's
 * `resolveAuthenticatedDestination()` — minus roles, because mobile has none.
 *
 * Lives in `lib/` rather than beside its hook so it stays pure and importable
 * without dragging the Supabase client (and therefore env) into a unit test.
 *
 * **Roles are not consulted.** A staff account signing into mobile is an
 * ordinary member; every mobile surface is member-scoped anyway.
 */
export function resolveDestination(input: {
  hasSession: boolean;
  suspended: boolean;
  profileComplete: boolean;
}): Destination {
  if (!input.hasSession) return "/login";
  if (input.suspended) return "/suspended";
  if (!input.profileComplete) return "/onboarding/welcome";
  return "/";
}
