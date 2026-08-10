import { Stack } from "expo-router";

/**
 * A real path segment, NOT a `(onboarding)` route group. A group does not
 * appear in the URL, so `(onboarding)/[step].tsx` compiles to a root-level
 * `/[step]` catch-all that swallows `/suspended` and every future sibling
 * route. `/onboarding/welcome` is also the literal `Destination` the launch
 * gate resolves (`lib/auth-destination.ts`).
 *
 * No guard here. The root layout owns the session gate via `Stack.Protected` —
 * signed out goes to `(auth)`, complete goes to the tabs — so a member only
 * reaches this group when she has a session and an incomplete profile.
 * Duplicating the check would give two places for the redirect to disagree.
 *
 * `gestureEnabled: false` because the step machine owns backward navigation:
 * a swipe back could land on a step the profile no longer makes reachable.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, animation: "fade", gestureEnabled: false }}
    />
  );
}
