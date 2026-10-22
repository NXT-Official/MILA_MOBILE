import type { QueryClient } from "@tanstack/react-query";

/**
 * expo-network's listener only reports changes. A phone that launched with no
 * connection never heard "offline", so TanStack still believed it was online,
 * the reconnect was not a change, and nothing refetched. On device: launched in
 * airplane mode, the launch gate's profile read used up its retries, and the
 * gate stayed on "Still trying to reach Mila" after the connection returned,
 * although its copy promises it opens on its own. The client now also reads
 * the connection once when it starts listening.
 *
 * Each test loads the client fresh: the online state lives in a module-level
 * singleton, and "at launch" only happens once per module.
 */

type NetworkEvent = { isConnected?: boolean; isInternetReachable?: boolean };

const mockAddListener = jest.fn();
const mockGetState = jest.fn();

jest.mock("expo-network", () => ({
  addNetworkStateListener: (...args: unknown[]) => mockAddListener(...args),
  getNetworkStateAsync: () => mockGetState(),
}));

jest.mock("@/services/api/client", () => ({
  ApiError: class ApiError extends Error {},
  NON_RETRYABLE_CODES: [],
}));

jest.mock("@/services/observability/query-errors", () => ({
  reportQueryError: jest.fn(),
}));

type Loaded = {
  queryClient: QueryClient;
  onlineManager: typeof import("@tanstack/react-query").onlineManager;
  QueryObserver: typeof import("@tanstack/react-query").QueryObserver;
};

let loaded: Loaded | undefined;

function load(): Loaded {
  jest.isolateModules(() => {
    const rq = require("@tanstack/react-query");
    const { queryClient } = require("@/services/query-client");
    loaded = { queryClient, onlineManager: rq.onlineManager, QueryObserver: rq.QueryObserver };
  });
  return loaded as Loaded;
}

function emit(event: NetworkEvent) {
  const { calls } = mockAddListener.mock;
  (calls[calls.length - 1]?.[0] as (e: NetworkEvent) => void)(event);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const OFFLINE = { isConnected: false, isInternetReachable: false };
const ONLINE = { isConnected: true, isInternetReachable: true };

beforeEach(() => {
  mockAddListener.mockReset().mockImplementation(() => ({ remove: jest.fn() }));
  mockGetState.mockReset();
  loaded = undefined;
});

afterEach(() => loaded?.queryClient.unmount());

it("knows it is offline when the app launched with no connection", async () => {
  mockGetState.mockResolvedValue(OFFLINE);
  const { queryClient, onlineManager } = load();
  queryClient.mount();
  await flush();

  expect(onlineManager.isOnline()).toBe(false);
});

it("refetches a read that failed for good at launch once the connection returns", async () => {
  mockGetState.mockResolvedValue(OFFLINE);
  const { queryClient, QueryObserver } = load();
  queryClient.mount();
  await flush();

  // The launch gate's profile read, retries already spent.
  const queryFn = jest
    .fn()
    .mockRejectedValueOnce(new Error("Network request failed"))
    .mockResolvedValue({ id: "member" });
  const observer = new QueryObserver(queryClient, { queryKey: ["profile"], queryFn, retry: false });
  const unsubscribe = observer.subscribe(() => {});
  await flush();
  expect(observer.getCurrentResult().status).toBe("error");

  emit(ONLINE);
  await flush();

  expect(queryFn).toHaveBeenCalledTimes(2);
  expect(observer.getCurrentResult().data).toEqual({ id: "member" });
  unsubscribe();
});

it("lets a change the listener heard win over a launch read that answers late", async () => {
  const late = deferred<NetworkEvent>();
  mockGetState.mockReturnValue(late.promise);
  const { queryClient, onlineManager } = load();
  queryClient.mount();

  emit(ONLINE);
  late.resolve(OFFLINE); // read before the change, answered after it
  await flush();

  expect(onlineManager.isOnline()).toBe(true);
});

it("stays online, without an unhandled rejection, when the launch read fails", async () => {
  mockGetState.mockRejectedValue(new Error("native module unavailable"));
  const { queryClient, onlineManager } = load();
  queryClient.mount();
  await flush();

  expect(onlineManager.isOnline()).toBe(true);
});

it.each([
  ["reachability unknown", { isConnected: true, isInternetReachable: undefined }, true],
  ["connected, internet unreachable", { isConnected: true, isInternetReachable: false }, false],
  ["nothing known", {}, true],
])("applies the useNetworkStatus rule to the launch read: %s", async (_name, state, online) => {
  mockGetState.mockResolvedValue(state);
  const { queryClient, onlineManager } = load();
  queryClient.mount();
  await flush();

  expect(onlineManager.isOnline()).toBe(online);
});

it("ignores a launch read that answers after listening stopped", async () => {
  const late = deferred<NetworkEvent>();
  mockGetState.mockReturnValue(late.promise);
  const { onlineManager } = load();
  // Replacing the listener is how TanStack stops listening; the old one is cleaned up.
  onlineManager.setEventListener(() => () => {});

  late.resolve(OFFLINE);
  await flush();

  expect(onlineManager.isOnline()).toBe(true);
});
