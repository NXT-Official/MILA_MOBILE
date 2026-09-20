/**
 * Real URLs, not group paths. Route groups — `(auth)`, `(tabs)` — do not appear
 * in the URL, so §4's `/(auth)/login` and `/(tabs)` literals do not type-check
 * under `experiments.typedRoutes`. The tabs index resolves to `/`.
 */
export type Destination =
  | "/login"
  | "/reset-password"
  | "/suspended"
  | "/onboarding/welcome"
  | "/";

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
  /**
   * Latched by the reset-password screen the instant it recognises a recovery
   * deep link — before it calls `setSession`. Checked first: `setSession`
   * makes `hasSession` true, and without this the launch gate would race the
   * member straight into the app (or onboarding) before she ever sets a new
   * password, exactly the onboarding-latch bug this same gate already guards
   * against elsewhere.
   */
  recovery: boolean;
}): Destination {
  if (input.recovery) return "/reset-password";
  if (!input.hasSession) return "/login";
  if (input.suspended) return "/suspended";
  if (!input.profileComplete) return "/onboarding/welcome";
  return "/";
}
