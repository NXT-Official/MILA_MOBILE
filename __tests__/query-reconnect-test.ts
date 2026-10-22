import { onlineManager, QueryObserver } from "@tanstack/react-query";
import { addNetworkStateListener } from "expo-network";

import { queryClient } from "@/services/query-client";

/**
 * React Native has no browser `online` event, so TanStack Query believed the
 * phone was always online and `refetchOnReconnect` never fired: a screen that
 * failed offline stayed failed after the connection came back (QA F2). The
 * client now hears connectivity from expo-network. Nothing else changes: a
 * request made offline still runs and fails (honest error state), and a
 * mutation is never parked to fire later on its own.
 */

type NetworkEvent = { isConnected?: boolean; isInternetReachable?: boolean };

jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// The listener query-client registered when it was imported (the most recent
// registration, since mounting the client may re-run its setup).
function mockEmit(event: NetworkEvent) {
  const { calls } = jest.mocked(addNetworkStateListener).mock;
  const listener = calls[calls.length - 1]?.[0] as ((e: NetworkEvent) => void) | undefined;
  listener?.(event);
}

jest.mock("@/services/api/client", () => ({
  ApiError: class ApiError extends Error {},
  NON_RETRYABLE_CODES: [],
}));

jest.mock("@/services/observability/query-errors", () => ({
  reportQueryError: jest.fn(),
}));

beforeAll(() => queryClient.mount());
afterAll(() => queryClient.unmount());

beforeEach(() => {
  queryClient.clear();
  mockEmit({ isConnected: true, isInternetReachable: true });
});

// TanStack batches its notifications on a zero-delay timer, so a few timer
// turns pass before a refetch it schedules has settled.
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

it("follows the device's connectivity", () => {
  mockEmit({ isConnected: false, isInternetReachable: false });
  expect(onlineManager.isOnline()).toBe(false);

  mockEmit({ isConnected: true, isInternetReachable: true });
  expect(onlineManager.isOnline()).toBe(true);
});

it("treats an unknown reachability as online, like useNetworkStatus", () => {
  mockEmit({ isConnected: true, isInternetReachable: undefined });
  expect(onlineManager.isOnline()).toBe(true);

  mockEmit({ isConnected: true, isInternetReachable: false });
  expect(onlineManager.isOnline()).toBe(false);
});

it("refetches a query that failed offline once the connection returns", async () => {
  mockEmit({ isConnected: false, isInternetReachable: false });

  const queryFn = jest
    .fn()
    .mockRejectedValueOnce(new Error("Network request failed"))
    .mockResolvedValue(["post"]);
  const observer = new QueryObserver(queryClient, {
    queryKey: ["feed-reconnect"],
    queryFn,
    retry: false,
  });
  const unsubscribe = observer.subscribe(() => {});

  await flush();
  // The offline attempt still runs and fails, so the screen shows its error.
  expect(queryFn).toHaveBeenCalledTimes(1);
  expect(observer.getCurrentResult().status).toBe("error");

  mockEmit({ isConnected: true, isInternetReachable: true });
  await flush();

  expect(queryFn).toHaveBeenCalledTimes(2);
  expect(observer.getCurrentResult().status).toBe("success");
  unsubscribe();
});

it("never parks a mutation offline to replay it on reconnect", async () => {
  mockEmit({ isConnected: false, isInternetReachable: false });

  const mutationFn = jest.fn().mockRejectedValue(new Error("Network request failed"));
  const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn });

  await expect(mutation.execute(undefined)).rejects.toThrow("Network request failed");
  expect(mutation.state.isPaused).toBe(false);

  mockEmit({ isConnected: true, isInternetReachable: true });
  await flush();
  expect(mutationFn).toHaveBeenCalledTimes(1);
});
