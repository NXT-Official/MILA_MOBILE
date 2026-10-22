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
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
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

// ── Adversarial: try to make the reconnect wiring misbehave ──────────────────

const OFFLINE = { isConnected: false, isInternetReachable: false };
const ONLINE = { isConnected: true, isInternetReachable: true };

function watch(key: string, queryFn: () => Promise<unknown>, extra: object = {}) {
  const observer = new QueryObserver(queryClient, { queryKey: [key], queryFn, retry: false, ...extra });
  const unsubscribe = observer.subscribe(() => {});
  return { observer, unsubscribe };
}

it("a flapping connection never runs two fetches of one query at once", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  let release: () => void = () => {};
  const queryFn = jest.fn(async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    // The first call fails at once; later calls hang until released, so every
    // reconnect below lands while a fetch is still in flight.
    if (queryFn.mock.calls.length === 1) {
      inFlight -= 1;
      throw new Error("Network request failed");
    }
    await new Promise<void>((r) => {
      release = r;
    });
    inFlight -= 1;
    return ["post"];
  });

  mockEmit(OFFLINE);
  const { observer, unsubscribe } = watch("flap", queryFn);
  await flush();

  for (let i = 0; i < 10; i += 1) {
    mockEmit(ONLINE);
    mockEmit(OFFLINE);
  }
  mockEmit(ONLINE);
  await flush();

  expect(maxInFlight).toBe(1);
  // One failed offline attempt and one refetch, however many times it flapped.
  expect(queryFn).toHaveBeenCalledTimes(2);

  release();
  await flush();
  expect(observer.getCurrentResult().status).toBe("success");
  unsubscribe();
});

it("a disabled query (no member signed in) stays silent on reconnect", async () => {
  const queryFn = jest.fn().mockResolvedValue("credits");
  mockEmit(OFFLINE);
  const { unsubscribe } = watch("disabled", queryFn, { enabled: false });

  mockEmit(ONLINE);
  await flush();

  expect(queryFn).not.toHaveBeenCalled();
  unsubscribe();
});

it("fresh data is not refetched on reconnect, so a flaky signal is not a request storm", async () => {
  const queryFn = jest.fn().mockResolvedValue(["post"]);
  const { unsubscribe } = watch("fresh", queryFn, { staleTime: 60_000 });
  await flush();
  expect(queryFn).toHaveBeenCalledTimes(1);

  for (let i = 0; i < 5; i += 1) {
    mockEmit(OFFLINE);
    mockEmit(ONLINE);
  }
  await flush();

  expect(queryFn).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("a failed query no screen is showing is not refetched on reconnect", async () => {
  mockEmit(OFFLINE);
  const queryFn = jest.fn().mockRejectedValue(new Error("Network request failed"));
  const { unsubscribe } = watch("left-behind", queryFn);
  await flush();
  unsubscribe(); // she navigated away

  mockEmit(ONLINE);
  await flush();

  expect(queryFn).toHaveBeenCalledTimes(1);
});

it("a mutation the network drops mid-flight is never replayed on reconnect", async () => {
  let fail: (e: Error) => void = () => {};
  const mutationFn = jest.fn(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn });

  const pending = mutation.execute(undefined);
  await flush();
  mockEmit(OFFLINE);
  fail(new Error("Network request failed"));
  await expect(pending).rejects.toThrow("Network request failed");

  mockEmit(ONLINE);
  await flush();
  await queryClient.resumePausedMutations();

  expect(mutationFn).toHaveBeenCalledTimes(1);
  expect(mutation.state.status).toBe("error");
});

it.each([
  [{ isConnected: false, isInternetReachable: true }, false],
  [{ isConnected: true, isInternetReachable: false }, false],
  [{ isConnected: undefined, isInternetReachable: undefined }, true],
  [{}, true],
])("connectivity event %j reads as online=%s", (event, online) => {
  mockEmit(event);
  expect(onlineManager.isOnline()).toBe(online);
});

it("removes its device listener when the last client unmounts, and listens again on remount", async () => {
  const listeners = jest.mocked(addNetworkStateListener);
  const before = listeners.mock.calls.length;
  const lastSubscription = listeners.mock.results[before - 1]?.value as { remove: jest.Mock };

  queryClient.unmount();
  expect(lastSubscription.remove).toHaveBeenCalledTimes(1);

  queryClient.mount();
  expect(listeners.mock.calls.length).toBe(before + 1);

  // The new listener still drives reconnect refetches.
  mockEmit(OFFLINE);
  const queryFn = jest
    .fn()
    .mockRejectedValueOnce(new Error("Network request failed"))
    .mockResolvedValue("ok");
  const { observer, unsubscribe } = watch("remount", queryFn);
  await flush();
  mockEmit(ONLINE);
  await flush();
  expect(observer.getCurrentResult().data).toBe("ok");
  unsubscribe();
});
