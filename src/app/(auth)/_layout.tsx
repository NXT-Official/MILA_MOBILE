import { Stack } from "expo-router";

/**
 * `login` is the group's default screen. Without it the fallback is the
 * filesystem order — `forgot-password` — so a signed-out member landing on the
 * group (a cold start whose URL resolved to nothing available) would meet the
 * reset form instead of the sign-in card. expo-router renamed this setting
 * from `initialRouteName` to `anchor` in the SDK 57 line.
 */
export const unstable_settings = {
  anchor: "login",
};

/**
 * No guard here. The root layout owns the session gate via `Stack.Protected`,
 * so an authenticated member never reaches this group in the first place.
 * Duplicating the check would give two places for the redirect to disagree.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
