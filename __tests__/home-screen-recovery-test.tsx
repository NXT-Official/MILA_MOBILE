import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import type { GenerationJob, GenerationJobKind } from "@/services/supabase/generation-jobs";
import type { DailyLook } from "@/types/look";
import type { DashboardProfile } from "@/types/models";

/**
 * R7 on the Home screen: a look or visual she started is never lost to a
 * remount, a trip to the background or a restart, and one press is one paid
 * request.
 *
 * The jobs hook is the real one over a real query client, so polling and the
 * foreground re-read are exercised; the job rows are the stub, scripted per
 * test. The three paid calls are stubs whose `mutate` records its variables and
 * callbacks, as in `home-screen-test.tsx`, so a test lands an answer exactly
 * when it chooses.
 */
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../src/components/layout/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../src/components/feedback/KeepAwake", () => ({ KeepAwake: () => null }));
jest.mock("../src/components/feedback/PaywallSheet", () => ({ PaywallSheet: () => null }));
jest.mock("../src/components/ui/ConfirmSheet", () => ({ ConfirmSheet: () => null }));
jest.mock("../src/features/dashboard/components/HubSheet", () => ({ HubSheet: () => null }));
jest.mock("../src/features/dashboard/components/VibePicker", () => ({
  VibePicker: () => null,
  VibeSheet: () => null,
}));
jest.mock("../src/features/dashboard/components/DailyPaletteGenerator", () => ({
  DailyPaletteGenerator: () => null,
}));
jest.mock("../src/features/dashboard/components/RecentLooksStrip", () => ({
  RecentLooksStrip: () => null,
}));
jest.mock("../src/features/dashboard/components/SelfiePhotoWidget", () => ({
  SelfiePhotoWidget: () => null,
}));
jest.mock("../src/features/dashboard/components/StatsRow", () => ({ StatsRow: () => null }));
jest.mock("../src/features/dashboard/components/TodayPlanFields", () => ({
  EMPTY_TODAY_PLAN: { agenda: "", dressCode: "", indoorOutdoor: "" },
  TodayPlanFields: () => null,
}));
jest.mock("../src/features/dashboard/components/ShopThisLookGrid", () => ({
  ShopThisLookGrid: () => null,
}));

jest.mock("../src/services/files", () => ({ files: { saveAndShareImage: jest.fn() } }));
jest.mock("../src/services/api/client", () => ({
  formatRetryAfter: () => "a moment",
  resolveApiFailure: () => ({ kind: "retryable", message: "Mila couldn't reach the studio." }),
}));
jest.mock("../src/services/weather", () => ({
  ...jest.requireActual("../src/services/weather"),
  fetchHubWeather: jest.fn(),
}));
jest.mock("../src/services/supabase/generation-jobs", () => ({
  fetchLatestGenerationJob: jest.fn(),
  fetchGenerationImage: jest.fn(),
  newClientRequestId: jest.fn(),
}));

type Callbacks = {
  onSuccess?: (value: unknown) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
};

function mutationStub() {
  const stub = {
    data: undefined as unknown,
    isPending: false,
    isError: false,
    error: null as unknown,
    variables: undefined as unknown,
    // What TanStack reports once the press has re-rendered: its variables, pending.
    mutate: jest.fn((variables: unknown, _callbacks?: Callbacks) => {
      stub.variables = variables;
      stub.isPending = true;
    }),
    reset: jest.fn(),
  };
  return stub;
}

const mockState = {
  profile: undefined as DashboardProfile | undefined,
  generate: mutationStub(),
  styleSheet: mutationStub(),
  photoPreview: mutationStub(),
};

jest.mock("../src/hooks/use-profile", () => ({
  useProfile: () => ({ data: mockState.profile, isPending: false }),
}));
jest.mock("../src/hooks/use-outfits", () => ({
  useOutfits: () => ({ data: undefined, isPending: false, refetch: jest.fn() }),
}));
jest.mock("../src/hooks/use-network-status", () => ({
  useNetworkStatus: () => ({ online: true }),
}));
jest.mock("../src/hooks/use-haptics", () => ({
  useHaptics: () => ({ selection: jest.fn(), success: jest.fn() }),
}));
jest.mock("../src/hooks/use-countdown", () => ({ useCountdown: () => 0 }));
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) =>
    select({ session: { user: { id: "member" } } }),
}));
jest.mock("../src/stores/concierge-store", () => ({
  useConciergeStore: (select: (state: { anchor: () => void }) => unknown) =>
    select({ anchor: jest.fn() }),
}));
jest.mock("../src/features/dashboard/hooks/use-generate-look", () => ({
  useGenerateLook: () => ({ ...mockState.generate }),
}));
jest.mock("../src/features/dashboard/hooks/use-style-sheet", () => ({
  useStyleSheet: () => ({ ...mockState.styleSheet }),
}));
jest.mock("../src/features/dashboard/hooks/use-photo-preview", () => ({
  usePhotoPreview: () => ({ ...mockState.photoPreview }),
}));
jest.mock("../src/features/dashboard/hooks/use-save-look", () => ({
  useSaveLook: () => ({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    mutate: jest.fn(),
    reset: jest.fn(),
  }),
}));

import { HomeScreen } from "@/features/dashboard/HomeScreen";
import {
  fetchGenerationImage,
  fetchLatestGenerationJob,
  newClientRequestId,
} from "@/services/supabase/generation-jobs";
import { fetchHubWeather } from "@/services/weather";

const fetchJob = jest.mocked(fetchLatestGenerationJob);
const fetchImage = jest.mocked(fetchGenerationImage);

const WEATHER = {
  label: "24°C Sunny",
  location: "Manila",
  country: "PH",
  icon: "sun",
  tempF: 75,
  tempC: 24,
  condition: "Sunny",
} as const;

const LOOK: DailyLook = {
  outfit: { headline: "Linen and light", description: "A light layer.", styling_notes: "Roll the cuff." },
  hair: { style: "Loose waves", execution_tip: "Air dry." },
  makeup: null,
  vibe_alignment_score: 8,
};
const OLDER_LOOK: DailyLook = { ...LOOK, outfit: { ...LOOK.outfit, headline: "Rain-ready layers" } };
const IMAGE = "data:image/jpeg;base64,QQ==";

function profile(overrides: Partial<DashboardProfile> = {}): DashboardProfile {
  return {
    full_name: "Nicole",
    skin_undertone: "Warm",
    color_season: "Autumn",
    color_season_base: "Autumn",
    body_type: "Hourglass",
    face_shape: "Oval",
    hair_type: "Wavy",
    hair_length: "Medium",
    gender: "Female",
    skin_depth: "Medium",
    makeup_preference: "none",
    color_profile: { season: "Autumn" },
    default_location: "manila",
    photo_consent_at: "2026-10-01T00:00:00Z",
    ...overrides,
  } as DashboardProfile;
}

function job(overrides: Partial<GenerationJob>): GenerationJob {
  return {
    id: "look-job",
    kind: "look",
    client_request_id: "request-1",
    status: "running",
    result: null,
    image_path: null,
    error_code: null,
    deadline_at: new Date(Date.now() + 240_000).toISOString(),
    created_at: new Date(Date.now() - 5_000).toISOString(),
    completed_at: null,
    ...overrides,
  };
}

/** What each kind's latest-job read answers; `unavailable` = migration missing. */
let rows: Partial<Record<GenerationJobKind, GenerationJob>> = {};
let jobsUnavailable = false;

let appStateListeners: ((state: AppStateStatus) => void)[] = [];
let appStateSpy: jest.SpyInstance | null = null;
let queryClient: QueryClient;
let refresh: () => Promise<void> = async () => {};
let unmountScreen: () => Promise<void> = async () => {};

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/**
 * Lets a chain of reads land: TanStack hands results to React on a timer (a fake
 * 0 ms timeout fires at 1 ms), and a read a previous result enabled (the image
 * after the job row) needs its own turn.
 */
async function settle() {
  for (let turn = 0; turn < 4; turn += 1) await advance(5);
}

/** Mounts Home over the shared query client (a remount reuses it, as the app does). */
async function mount() {
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <HomeScreen />
    </QueryClientProvider>
  );
  const view = await render(tree());
  refresh = async () => {
    await view.rerender(tree());
  };
  unmountScreen = async () => {
    await act(async () => view.unmount());
  };
  await settle();
  return view;
}

/** A fresh screen instance: its own mutation observers, empty. */
function freshMutations() {
  mockState.generate = mutationStub();
  mockState.styleSheet = mutationStub();
  mockState.photoPreview = mutationStub();
}

const createButton = () => screen.findByRole("button", { name: /^Create my look/ });
const lastCall = (stub: ReturnType<typeof mutationStub>) => {
  const calls = stub.mutate.mock.calls;
  return calls[calls.length - 1] as [Record<string, unknown>, Callbacks];
};

/**
 * What the real hooks do on settle (their own tests pin it): her jobs are
 * read again by their explicit key.
 */
async function hookSettled() {
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ["generation-jobs", "member"] });
  });
  await settle();
}

/** Lands the latest call's answer the way TanStack would, then re-renders. */
async function answer(stub: ReturnType<typeof mutationStub>, value: unknown) {
  const [, callbacks] = lastCall(stub);
  stub.isPending = false;
  stub.data = value;
  await act(async () => {
    callbacks.onSuccess?.(value);
    callbacks.onSettled?.();
  });
  await refresh();
  await hookSettled();
}

async function fail(stub: ReturnType<typeof mutationStub>, error: unknown) {
  const [, callbacks] = lastCall(stub);
  stub.isPending = false;
  stub.isError = true;
  stub.error = error;
  await act(async () => {
    callbacks.onError?.(error);
    callbacks.onSettled?.();
  });
  await refresh();
  await hookSettled();
}

async function foreground() {
  await act(async () => {
    appStateListeners.forEach((listener) => listener("background"));
    appStateListeners.forEach((listener) => listener("active"));
  });
  await settle();
}

const composingProgress = () => screen.queryByLabelText("Composing your look");
const failureCopy = () =>
  screen.queryByText(/didn.t come together|couldn't be generated|could not be generated/);

let nextId = 0;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  freshMutations();
  mockState.profile = profile();
  rows = {};
  jobsUnavailable = false;
  nextId = 0;
  jest.mocked(newClientRequestId).mockImplementation(() => `request-${(nextId += 1)}`);
  jest.mocked(fetchHubWeather).mockResolvedValue(WEATHER);
  fetchJob.mockImplementation(async (_userId, kind) =>
    jobsUnavailable ? { status: "unavailable" } : { status: "ok", job: rows[kind] ?? null },
  );
  fetchImage.mockResolvedValue(IMAGE);
  appStateListeners = [];
  appStateSpy = jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return { remove: jest.fn() };
  });
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } },
  });
});

afterEach(async () => {
  await unmountScreen();
  queryClient.clear();
  jest.useRealTimers();
  appStateSpy?.mockRestore();
});

describe("a look still being composed", () => {
  it("is re-attached after a remount, and lands without a second request", async () => {
    await mount();
    await fireEvent.press(await createButton());
    expect(mockState.generate.mutate).toHaveBeenCalledTimes(1);
    expect(lastCall(mockState.generate)[0].clientRequestId).toBe("request-1");

    // The server has started her job; the screen goes away mid-generation.
    rows.look = job({ client_request_id: "request-1" });
    await unmountScreen();
    freshMutations();

    await mount();
    expect(composingProgress()).toBeTruthy();
    expect(screen.getByText(/you can leave the app/i)).toBeTruthy();
    expect(screen.queryByText("Set the mood. Mila will compose the rest.")).toBeNull();
    const cta = screen.getByRole("button", { name: /^Composing/ });
    expect(cta.props.accessibilityState?.disabled).toBe(true);

    rows.look = job({ client_request_id: "request-1", status: "succeeded", result: LOOK });
    await advance(3_000);
    await settle();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(composingProgress()).toBeNull();
    expect(mockState.generate.mutate).not.toHaveBeenCalled();
  });

  it("is picked up the moment the app comes back from the background", async () => {
    rows.look = job({});
    await mount();
    expect(composingProgress()).toBeTruthy();

    rows.look = job({ status: "succeeded", result: LOOK });
    await foreground();

    expect(screen.getByText("Linen and light")).toBeTruthy();
  });
});

describe("a double press", () => {
  it("sends one request with one key", async () => {
    await mount();
    const cta = await createButton();

    await fireEvent.press(cta);
    await fireEvent.press(cta);

    expect(mockState.generate.mutate).toHaveBeenCalledTimes(1);
    expect(lastCall(mockState.generate)[0].clientRequestId).toBe("request-1");
  });

  it("never leaves the CTA dead when a settled press's answer did not reach the screen", async () => {
    await mount();
    await fireEvent.press(await createButton());
    // The hook settled the press, but its per-call callbacks never ran here.
    mockState.generate.isPending = false;
    mockState.generate.isError = true;
    await refresh();

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(mockState.generate.mutate).toHaveBeenCalledTimes(2);
    expect(lastCall(mockState.generate)[0].clientRequestId).toBe("request-2");
  });

  it("gives the look and its style sheet keys of their own", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await answer(mockState.generate, { ...LOOK, jobId: "look-job" });

    expect(mockState.styleSheet.mutate).toHaveBeenCalledTimes(1);
    expect(lastCall(mockState.styleSheet)[0]).toEqual({
      outfit: { ...LOOK, jobId: "look-job" },
      clientRequestId: "request-2",
    });
  });
});

describe("her own look, finished after its answer was lost", () => {
  it("is shown, and gets the style sheet that press would have asked for", async () => {
    await mount();
    await fireEvent.press(await createButton());
    rows.look = job({ client_request_id: "request-1" });
    await fail(mockState.generate, new Error("Network request failed"));

    expect(composingProgress()).toBeTruthy();
    expect(failureCopy()).toBeNull();

    rows.look = job({ client_request_id: "request-1", status: "succeeded", result: LOOK });
    await advance(3_000);
    await settle();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(mockState.styleSheet.mutate).toHaveBeenCalledTimes(1);
    expect(lastCall(mockState.styleSheet)[0]).toEqual({ outfit: LOOK, clientRequestId: "request-2" });
  });

  it("is never stood in for by an older look when the press did not reach the server", async () => {
    rows.look = job({ id: "older", client_request_id: "older", status: "succeeded", result: OLDER_LOOK });
    await mount();
    expect(screen.getByText("Rain-ready layers")).toBeTruthy();

    await fireEvent.press(await createButton());
    await fail(mockState.generate, new Error("Network request failed"));

    expect(screen.queryByText("Rain-ready layers")).toBeNull();
    expect(screen.getByText("Mila couldn't reach the studio.")).toBeTruthy();
  });
});

describe("a visual drawn while she was away", () => {
  it("is shown on a fresh mount, read from its own stored image", async () => {
    rows.look = job({ status: "succeeded", result: LOOK, created_at: new Date(Date.now() - 60_000).toISOString() });
    const sheet = job({
      id: "sheet-job",
      kind: "style_sheet",
      client_request_id: "sheet-request",
      status: "succeeded",
      image_path: "member/sheet-job.jpg",
      result: { mode: "style_sheet" },
    });
    rows.style_sheet = sheet;
    await mount();

    expect(fetchImage).toHaveBeenCalledWith(sheet);
    expect(screen.getByLabelText("Identity-locked style sheet of Linen and light")).toBeTruthy();
    expect(mockState.styleSheet.mutate).not.toHaveBeenCalled();
  });

  it("is read again, never drawn again, when its image could not be fetched", async () => {
    rows.look = job({ status: "succeeded", result: LOOK, created_at: new Date(Date.now() - 60_000).toISOString() });
    rows.style_sheet = job({
      id: "sheet-job",
      kind: "style_sheet",
      client_request_id: "sheet-request",
      status: "succeeded",
      image_path: "member/sheet-job.jpg",
      result: { mode: "style_sheet" },
    });
    fetchImage.mockRejectedValueOnce(new Error("offline"));
    await mount();

    await fireEvent.press(screen.getByRole("button", { name: "Retry visual" }));
    await settle();

    expect(mockState.styleSheet.mutate).not.toHaveBeenCalled();
    expect(fetchImage).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Identity-locked style sheet of Linen and light")).toBeTruthy();
  });

  it("is shown as still rendering, and keeps the next look from being charged on top of it", async () => {
    rows.look = job({ status: "succeeded", result: LOOK, created_at: new Date(Date.now() - 60_000).toISOString() });
    rows.style_sheet = job({ id: "sheet-job", kind: "style_sheet", client_request_id: "sheet-request" });
    await mount();

    expect(screen.getByLabelText("Building your style sheet…")).toBeTruthy();
    const tryAnother = screen.getByRole("button", { name: "Try another look" });
    expect(tryAnother.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(tryAnother);
    expect(mockState.generate.mutate).not.toHaveBeenCalled();
  });
});

describe("a row that was delivered but could not be stored", () => {
  it("stays delivered on screen, never a failure", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await answer(mockState.generate, { ...LOOK, jobId: null });
    await answer(mockState.styleSheet, { mode: "style_sheet", imageDataUri: IMAGE, jobId: null });

    rows.look = job({ client_request_id: "request-1", status: "failed", error_code: "persist_failed_delivered" });
    rows.style_sheet = job({
      id: "sheet-job",
      kind: "style_sheet",
      client_request_id: "request-2",
      status: "failed",
      error_code: "persist_failed_delivered",
    });
    await foreground();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(screen.getByLabelText("Identity-locked style sheet of Linen and light")).toBeTruthy();
    expect(failureCopy()).toBeNull();
  });

  it("leaves a delivered style sheet out of the slot after a restart, never failed", async () => {
    rows.look = job({ status: "succeeded", result: LOOK, created_at: new Date(Date.now() - 60_000).toISOString() });
    rows.style_sheet = job({
      id: "sheet-job",
      kind: "style_sheet",
      client_request_id: "sheet-request",
      status: "failed",
      error_code: "persist_failed_delivered",
    });
    await mount();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(failureCopy()).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry visual" })).toBeNull();
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("is not reported as a failure after a restart either", async () => {
    rows.look = job({ status: "failed", error_code: "persist_failed_delivered" });
    await mount();

    expect(failureCopy()).toBeNull();
    expect(composingProgress()).toBeNull();
    expect(screen.getByText("Set the mood. Mila will compose the rest.")).toBeTruthy();
  });
});

describe("while the generation_jobs migration is missing", () => {
  it("behaves as today: nothing recovered, nothing polled, the press still works", async () => {
    jobsUnavailable = true;
    await mount();

    expect(screen.getByText("Set the mood. Mila will compose the rest.")).toBeTruthy();
    expect(screen.queryByText(/you can leave the app/i)).toBeNull();

    await fireEvent.press(await createButton());
    mockState.generate.isPending = true;
    await refresh();
    expect(composingProgress()).toBeTruthy();
    // Leaving would lose it today, so the screen does not promise otherwise.
    expect(screen.queryByText(/you can leave the app/i)).toBeNull();
    await answer(mockState.generate, LOOK);

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(mockState.styleSheet.mutate).toHaveBeenCalledTimes(1);

    const readsBefore = fetchJob.mock.calls.length;
    await advance(30_000);
    expect(fetchJob.mock.calls.length).toBe(readsBefore);
  });
});
