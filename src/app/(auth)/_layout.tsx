import { Stack } from "expo-router";

/**
 * No guard here. The root layout owns the session gate via `Stack.Protected`,
 * so an authenticated member never reaches this group in the first place.
 * Duplicating the check would give two places for the redirect to disagree.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
