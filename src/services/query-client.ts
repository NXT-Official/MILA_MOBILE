import { MutationCache, onlineManager, QueryCache, QueryClient } from "@tanstack/react-query";
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from "expo-network";

import { ApiError, NON_RETRYABLE_CODES } from "./api/client";
import { reportQueryError } from "./observability/query-errors";

// React Native has no browser `online` event, so without this the client
// believes it is always online and `refetchOnReconnect` never fires: a screen
// that failed offline stayed failed when the connection came back (QA F2).
// An unknown reachability counts as online, the same rule as useNetworkStatus.
onlineManager.setEventListener((setOnline) => {
  const apply = ({ isConnected, isInternetReachable }: NetworkState) =>
    setOnline(isConnected !== false && isInternetReachable !== false);
  // The listener only reports changes. Launched offline, nothing ever said so,
  // the reconnect was not a change, and a launch read that had spent its
  // retries never refetched: the launch gate stayed up. Read the connection
  // once; a change heard first is newer, so it wins.
  let heard = false;
  const subscription = addNetworkStateListener((state) => {
    heard = true;
    apply(state);
  });
  getNetworkStateAsync()
    .then((state) => {
      if (!heard) apply(state);
    })
    .catch(() => {});
  return () => {
    heard = true;
    subscription.remove();
  };
});

export const queryClient = new QueryClient({
  // Every failed query and mutation reaches the observability facade, which
  // filters the outcomes the product handles on purpose (paywall, offline...).
  queryCache: new QueryCache({
    onError: (error, query) => reportQueryError(error, { kind: "query", key: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (error) => reportQueryError(error, { kind: "mutation" }),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      retry: (count, error) => {
        if (error instanceof ApiError && NON_RETRYABLE_CODES.includes(error.code as never)) {
          return false;
        }
        return count < 2;
      },
      // Web semantics do not apply on a phone; use useAppState instead.
      refetchOnWindowFocus: false,
      // Connectivity only triggers the reconnect refetch. An offline request
      // still runs and fails, so screens show their error state instead of a
      // skeleton that waits forever. "always" turns the reconnect refetch off
      // by default, so it is switched back on explicitly.
      networkMode: "always",
      refetchOnReconnect: true,
    },
    // Never auto-retry a credit-charging call — a retry is a double charge.
    // "always" for the same reason: a mutation is never parked offline and
    // replayed on its own when the connection returns.
    mutations: { retry: false, networkMode: "always" },
  },
});
