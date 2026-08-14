import { useNetworkState } from "expo-network";

/**
 * Whether the device can reach the internet.
 *
 * Used only to disable a control with honest copy — never to decide what the
 * member is entitled to. `isInternetReachable` is undefined until the first
 * probe resolves, and an unknown answer is treated as online: showing "you are
 * offline" for a second on every cold start is worse than a request that fails
 * and retries.
 */
export function useNetworkStatus(): { online: boolean } {
  const { isConnected, isInternetReachable } = useNetworkState();

  const online = isConnected !== false && isInternetReachable !== false;
  return { online };
}
