import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import type { GenerationJob, GenerationJobKind } from "@/services/supabase/generation-jobs";
import type { DailyLook } from "@/types/look";
import type { DashboardProfile } from "@/types/models";

/**
 * R7 on the Home screen: a look or visual she started is never lost to a
 * remount, a trip to the background or a restart; one press is one paid
 * request; and a visual is only ever shown or saved with the look it was drawn
 * for.
 *
 * The jobs hook and the press ledger are the real ones over a real query
 * client (and the in-memory AsyncStorage mock), so polling, the foreground
 * re-read and "is this press hers" are exercised; the job rows are the stub,
 * scripted per test. The three paid calls are stubs whose `mutate` records its
 * variables and callbacks, as in `home-screen-test.tsx`, so a test lands an
 * answer exactly when it chooses.
 */
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../src/components/layout/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../src/components/feedback/KeepAwake", () => ({ KeepAwake: () => null }));
jest.mock("../src/components/feedback/PaywallSheet", () => ({ PaywallSheet: () => null }));
jest.mock("../src/components/ui/ConfirmSheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    ConfirmSheet: (p: {
      visible: boolean;
      title: string;
      message: string;
      confirmLabel: string;
      onConfirm: () => void;
    }) =>
      p.visible ? (
        <View>
          <Text>{p.title}</Text>
          <Text>{p.message}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={p.confirmLabel} onPress={p.onConfirm}>
            <Text>{p.confirmLabel}</Text>
          </Pressable>
        </View>
      ) : null,
  };
});
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
  fetchGenerationJobByRequest: jest.fn(),
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
    submittedAt: 0,
    // What TanStack reports once the press has re-rendered: its variables, pending.
    mutate: jest.fn((variables: unknown, _callbacks?: Callbacks) => {
      stub.variables = variables;
      stub.submittedAt = Date.now();
      stub.isPending = true;
      stub.isError = false;
      stub.data = undefined;
    }),
    reset: jest.fn(),
  };
  return stub;
}

type OutfitRowLike = { analysis_result: unknown; created_at: string };

const mockState = {
  profile: undefined as DashboardProfile | undefined,
  outfits: undefined as OutfitRowLike[] | undefined,
  generate: mutationStub(),
  styleSheet: mutationStub(),
  photoPreview: mutationStub(),
  saveMutate: jest.fn(),
};

jest.mock("../src/hooks/use-profile", () => ({
  useProfile: () => ({ data: mockState.profile, isPending: false }),
}));
jest.mock("../src/hooks/use-outfits", () => ({
  useOutfits: () => ({ data: mockState.outfits, isPending: false, refetch: jest.fn() }),
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
    mutate: mockState.saveMutate,
    reset: jest.fn(),
  }),
}));

import { HomeScreen } from "@/features/dashboard/HomeScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiError } from "@/services/api/errors";
import {
  fetchGenerationImage,
  fetchGenerationJobByRequest,
  fetchLatestGenerationJob,
  newClientRequestId,
} from "@/services/supabase/generation-jobs";
import { fetchHubWeather } from "@/services/weather";
import { useGenerationPressStore } from "@/stores/generation-press-store";
import { useVibeStore } from "@/stores/vibe-store";

const fetchJob = jest.mocked(fetchLatestGenerationJob);
const fetchByRequest = jest.mocked(fetchGenerationJobByRequest);
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
const OTHER_LOOK: DailyLook = {
  ...LOOK,
  outfit: { ...LOOK.outfit, headline: "Rain-ready layers", description: "A shell over knit." },
};
const IMAGE = "data:image/jpeg;base64,QQ==";
const IMAGE_A = "data:image/jpeg;base64,QUFB";

const lost = () => new ApiError("NETWORK", "Mila couldn't reach the studio. Check your connection.", 0);
const serverError = () => new ApiError("AI_UNAVAILABLE", "Mila couldn't compose a look this time.", 503);

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
    credit_state: "charged",
    result: null,
    image_path: null,
    error_code: null,
    deadline_at: new Date(Date.now() + 240_000).toISOString(),
    created_at: new Date(Date.now() - 5_000).toISOString(),
    completed_at: null,
    for_look: null,
    look_input: { vibe: "Brunch", weather: "24°C Sunny (in Manila)" },
    ...overrides,
  };
}

/** A succeeded look row, finished a minute ago. */
const doneLook = (look: DailyLook, overrides: Partial<GenerationJob> = {}) =>
  job({
    status: "succeeded",
    result: look,
    created_at: new Date(Date.now() - 120_000).toISOString(),
    completed_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  });

/** A style sheet row drawn for `look`. */
const sheetFor = (look: DailyLook, overrides: Partial<GenerationJob> = {}) =>
  job({
    id: "sheet-job",
    kind: "style_sheet",
    client_request_id: "sheet-request",
    look_input: null,
    for_look: { headline: look.outfit.headline, description: look.outfit.description },
    created_at: new Date(Date.now() - 30_000).toISOString(),
    ...overrides,
  });

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
const keyOf = (call: unknown[]) => (call[0] as { clientRequestId: string }).clientRequestId;
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

/** A press of hers this phone remembers from before a restart. */
function rememberPress(kind: "look" | "style_sheet", id: string, at: number = Date.now()) {
  useGenerationPressStore
    .getState()
    .remember("member", kind, { id, at, fingerprint: null, context: null });
}

const HOUR = 3_600_000;

const composingProgress = () => screen.queryByLabelText("Composing your look");
const failureCopy = () =>
  screen.queryByText(/didn.t come together|couldn't be generated|could not be generated/);
const sheetImageOf = (look: DailyLook) =>
  screen.queryByLabelText(`Identity-locked style sheet of ${look.outfit.headline}`);
const saveButton = () => screen.getByRole("button", { name: "Save to history" });
const isDisabled = (element: { props: { accessibilityState?: { disabled?: boolean } } }) =>
  Boolean(element.props.accessibilityState?.disabled);

let nextId = 0;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  freshMutations();
  mockState.profile = profile();
  mockState.outfits = undefined;
  rows = {};
  jobsUnavailable = false;
  nextId = 0;
  useGenerationPressStore.setState({ presses: {}, hydrated: true });
  useVibeStore.setState({ vibe: "Everyday Casual" });
  fetchByRequest.mockResolvedValue({ status: "ok", job: null });
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
  it("is re-attached after a remount, lands without a second request, and gets its free style sheet", async () => {
    await mount();
    await fireEvent.press(await createButton());
    expect(mockState.generate.mutate).toHaveBeenCalledTimes(1);
    expect(keyOf(lastCall(mockState.generate))).toBe("request-1");

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
    // Her own press, so it continues to the sheet the press would have asked for.
    expect(mockState.styleSheet.mutate).toHaveBeenCalledTimes(1);
    expect(lastCall(mockState.styleSheet)[0]).toEqual({ outfit: LOOK, clientRequestId: "request-2" });
  });

  it("is picked up the moment the app comes back from the background", async () => {
    rows.look = job({});
    await mount();
    expect(composingProgress()).toBeTruthy();

    rows.look = job({ status: "succeeded", result: LOOK });
    await foreground();

    expect(screen.getByText("Linen and light")).toBeTruthy();
  });

  it("shows as composing after a remount while the press is still in flight, before its row exists", async () => {
    // The old screen's look mutation is still in flight in the shared cache.
    void queryClient
      .getMutationCache()
      .build(queryClient, { mutationKey: ["generation", "look"], mutationFn: () => new Promise(() => {}) })
      .execute(undefined);
    await mount();

    expect(composingProgress()).toBeTruthy();
    expect(screen.queryByText("Set the mood. Mila will compose the rest.")).toBeNull();
  });
});

describe("a double press", () => {
  it("sends one request with one key", async () => {
    await mount();
    const cta = await createButton();

    await fireEvent.press(cta);
    await fireEvent.press(cta);

    expect(mockState.generate.mutate).toHaveBeenCalledTimes(1);
    expect(keyOf(lastCall(mockState.generate))).toBe("request-1");
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
    // No answer was heard for that press, so the same key is sent again.
    expect(keyOf(lastCall(mockState.generate))).toBe("request-1");
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

describe("Try again after a call that ended", () => {
  it("resends the same key when the connection dropped, so a look that finished is replayed, not charged again", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await fail(mockState.generate, lost());

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(mockState.generate.mutate.mock.calls.map(keyOf)).toEqual(["request-1", "request-1"]);
    // The resend is marked, so its (replayed) answer is not counted as a new look.
    const resentFlags = mockState.generate.mutate.mock.calls.map(
      (call) => (call[0] as { resent?: boolean }).resent,
    );
    expect(resentFlags).toEqual([false, true]);
  });

  it.each([
    ["a gateway's non-JSON 502", () => new ApiError("INTERNAL", "Something went wrong.", 502)],
    ["a 503 page from a proxy", () => new ApiError("INTERNAL", "Something went wrong.", 503)],
    ["a 401 while her session refreshes", () => new ApiError("UNAUTHENTICATED", "Please sign in again.", 401)],
  ])("resends the same key after %s, which says nothing about her job", async (_label, error) => {
    await mount();
    await fireEvent.press(await createButton());
    await fail(mockState.generate, error());

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(mockState.generate.mutate.mock.calls.map(keyOf)).toEqual(["request-1", "request-1"]);
  });

  it("mints a new key after a real answer from the server", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await fail(mockState.generate, serverError());

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(mockState.generate.mutate.mock.calls.map(keyOf)).toEqual(["request-1", "request-2"]);
  });

  it("resends the style sheet's key too, for the same look", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await answer(mockState.generate, LOOK);
    await fail(mockState.styleSheet, lost());

    await fireEvent.press(screen.getByRole("button", { name: "Retry visual" }));

    expect(mockState.styleSheet.mutate.mock.calls.map(keyOf)).toEqual(["request-2", "request-2"]);
  });

  it("sends a new key for New visual once that sheet's own image is on screen", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await answer(mockState.generate, LOOK);
    await fail(mockState.styleSheet, lost());
    // Its job finished after all, and its image is read back and shown.
    rows.style_sheet = sheetFor(LOOK, {
      client_request_id: "request-2",
      status: "succeeded",
      image_path: "member/sheet-job.jpg",
    });
    await foreground();
    expect(sheetImageOf(LOOK)).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "New visual" }));
    await fireEvent.press(screen.getByRole("button", { name: "Use 1 credit" }));

    // A redraw is a new request: resending would only replay the same image.
    expect(mockState.styleSheet.mutate.mock.calls.map(keyOf)).toEqual(["request-2", "request-3"]);
  });
});

describe("her own look, finished after its answer was lost", () => {
  it("is shown, and gets the style sheet that press would have asked for", async () => {
    await mount();
    await fireEvent.press(await createButton());
    rows.look = job({ client_request_id: "request-1" });
    await fail(mockState.generate, lost());

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
    rows.look = doneLook(OTHER_LOOK, { id: "older", client_request_id: "older" });
    await mount();
    expect(screen.getByText("Rain-ready layers")).toBeTruthy();

    await fireEvent.press(await createButton());
    await fail(mockState.generate, lost());

    expect(screen.queryByText("Rain-ready layers")).toBeNull();
    expect(screen.getByText("Mila couldn't reach the studio.")).toBeTruthy();
  });

  it("says her credit is back when that press's job failed out of sight", async () => {
    rememberPress("look", "request-9");
    rows.look = job({
      client_request_id: "request-9",
      status: "failed",
      error_code: "deadline_exceeded",
      credit_state: "refunded",
    });
    await mount();

    expect(screen.getByText("Mila couldn't finish your look. Your credit is back.")).toBeTruthy();
    expect(composingProgress()).toBeNull();
  });
});

describe("after a restart", () => {
  it("puts her own finished look back and draws its free style sheet, once", async () => {
    rememberPress("look", "request-7");
    rows.look = doneLook(LOOK, { client_request_id: "request-7" });
    await mount();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(mockState.styleSheet.mutate).toHaveBeenCalledTimes(1);
    expect(lastCall(mockState.styleSheet)[0]).toEqual({ outfit: LOOK, clientRequestId: "request-1" });

    await foreground();
    expect(mockState.styleSheet.mutate).toHaveBeenCalledTimes(1);
  });

  it("offers a look from elsewhere its style sheet as not drawn yet, with no credit claim", async () => {
    rows.look = doneLook(LOOK, { client_request_id: "elsewhere" });
    await mount();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(mockState.styleSheet.mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Your look is ready. Its style sheet hasn't been drawn yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New visual" })).toBeNull();
    expect(screen.queryByText(/uses 1 credit/)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Draw style sheet" }));

    expect(mockState.styleSheet.mutate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Use 1 credit")).toBeNull();
  });

  it("does not put back a look she has already saved", async () => {
    rows.look = doneLook(LOOK);
    mockState.outfits = [{ analysis_result: LOOK, created_at: new Date().toISOString() }];
    await mount();

    expect(screen.queryByText("Linen and light")).toBeNull();
    expect(screen.getByText("Set the mood. Mila will compose the rest.")).toBeTruthy();
  });

  it("brings back a look started at 23:58 and finished at 00:02 when she opens the app at 00:05", async () => {
    jest.setSystemTime(new Date(2026, 9, 7, 0, 5, 0));
    rows.look = doneLook(LOOK, {
      created_at: new Date(2026, 9, 6, 23, 58, 0).toISOString(),
      completed_at: new Date(2026, 9, 7, 0, 2, 0).toISOString(),
      deadline_at: new Date(2026, 9, 7, 0, 3, 0).toISOString(),
    });
    await mount();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    // From today: no time label.
    expect(screen.queryByText(/^From /)).toBeNull();
  });

  it("labels last night's look with its time, and badges and saves it under its own vibe and weather", async () => {
    jest.setSystemTime(new Date(2026, 9, 7, 7, 40, 0));
    rows.look = doneLook(LOOK, {
      created_at: new Date(2026, 9, 6, 23, 38, 0).toISOString(),
      completed_at: new Date(2026, 9, 6, 23, 40, 0).toISOString(),
      deadline_at: new Date(2026, 9, 6, 23, 43, 0).toISOString(),
    });
    rows.style_sheet = sheetFor(LOOK, {
      status: "succeeded",
      image_path: "member/sheet-job.jpg",
      created_at: new Date(2026, 9, 6, 23, 41, 0).toISOString(),
      completed_at: new Date(2026, 9, 6, 23, 42, 0).toISOString(),
      deadline_at: new Date(2026, 9, 6, 23, 46, 0).toISOString(),
    });
    await mount();

    expect(screen.getByText("From last night, 11:40 PM")).toBeTruthy();
    expect(screen.getByText("Brunch")).toBeTruthy();
    // Today's weather stays in the weather panel only: no badge claims it for last night's look.
    expect(screen.getAllByText("24°C Sunny")).toHaveLength(1);

    await fireEvent.press(saveButton());
    expect(mockState.saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ vibe: "Brunch", weather: "24°C Sunny (Manila)", imageDataUri: IMAGE }),
      expect.anything(),
    );
  });

  it("lets a finished look from more than 12 hours ago, before today, stay in History", async () => {
    jest.setSystemTime(new Date(2026, 9, 7, 9, 0, 0));
    rows.look = doneLook(LOOK, {
      created_at: new Date(2026, 9, 6, 20, 58, 0).toISOString(),
      completed_at: new Date(2026, 9, 6, 20, 59, 0).toISOString(),
      deadline_at: new Date(2026, 9, 6, 21, 3, 0).toISOString(),
    });
    await mount();

    expect(screen.queryByText("Linen and light")).toBeNull();
  });
});

describe("a visual belongs to exactly one look", () => {
  it("is cleared at once by Try another look, and the new look's failed sheet never shows or saves the old image", async () => {
    rows.look = doneLook(LOOK, { id: "look-1", client_request_id: "elsewhere-1" });
    rows.style_sheet = sheetFor(LOOK, { status: "succeeded", image_path: "member/sheet-1.jpg" });
    fetchImage.mockResolvedValue(IMAGE_A);
    await mount();
    const oldSheet = sheetImageOf(LOOK);
    expect(oldSheet).toBeTruthy();
    await act(async () => oldSheet?.props.onDisplay?.());
    await refresh();

    await fireEvent.press(screen.getByRole("button", { name: "Try another look" }));
    expect(sheetImageOf(LOOK)).toBeNull();
    expect(screen.queryByText("Linen and light")).toBeNull();

    await answer(mockState.generate, { ...OTHER_LOOK, jobId: "look-2" });
    expect(mockState.styleSheet.mutate).toHaveBeenCalledTimes(1);
    // While the new sheet renders, the new look has no visual of its own yet.
    expect(isDisabled(saveButton())).toBe(true);

    await fail(mockState.styleSheet, lost());
    expect(sheetImageOf(OTHER_LOOK)).toBeNull();
    expect(isDisabled(saveButton())).toBe(true);
  });

  it("keeps the look on screen, and its sheet, when another device composes a newer look", async () => {
    rows.look = doneLook(LOOK, { id: "look-1", client_request_id: "elsewhere-1" });
    await mount();
    await fireEvent.press(screen.getByRole("button", { name: "Draw style sheet" }));
    await answer(mockState.styleSheet, { mode: "style_sheet", imageDataUri: IMAGE_A });
    expect(sheetImageOf(LOOK)).toBeTruthy();

    rows.look = doneLook(OTHER_LOOK, { id: "look-2", client_request_id: "elsewhere-2" });
    await foreground();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(screen.queryByText("Rain-ready layers")).toBeNull();
    expect(sheetImageOf(LOOK)).toBeTruthy();
    expect(sheetImageOf(OTHER_LOOK)).toBeNull();
  });

  it("never takes a sheet drawn for a different look, however recent", async () => {
    rows.look = doneLook(LOOK);
    rows.style_sheet = sheetFor(OTHER_LOOK, { status: "succeeded", image_path: "member/other.jpg" });
    await mount();

    expect(fetchImage).not.toHaveBeenCalled();
    expect(sheetImageOf(LOOK)).toBeNull();
    expect(screen.getByRole("button", { name: "Draw style sheet" })).toBeTruthy();
  });
});

describe("a visual drawn while she was away", () => {
  it("is shown on a fresh mount, read from its own stored image", async () => {
    rows.look = doneLook(LOOK);
    const sheet = sheetFor(LOOK, { status: "succeeded", image_path: "member/sheet-job.jpg" });
    rows.style_sheet = sheet;
    await mount();

    expect(fetchImage).toHaveBeenCalledWith(sheet, expect.anything());
    expect(sheetImageOf(LOOK)).toBeTruthy();
    expect(mockState.styleSheet.mutate).not.toHaveBeenCalled();
  });

  it("is read again, never drawn again, when its image could not be fetched", async () => {
    rows.look = doneLook(LOOK);
    rows.style_sheet = sheetFor(LOOK, { status: "succeeded", image_path: "member/sheet-job.jpg" });
    fetchImage.mockRejectedValueOnce(new Error("offline"));
    await mount();

    // It was drawn and paid for: the copy says it could not be loaded.
    expect(screen.getByText("Your style sheet is ready, but it couldn't be loaded.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry visual" }));
    await settle();

    expect(mockState.styleSheet.mutate).not.toHaveBeenCalled();
    expect(fetchImage).toHaveBeenCalledTimes(2);
    expect(sheetImageOf(LOOK)).toBeTruthy();
  });

  it("never holds Create or Try another when its read timed out: the slot offers its retry", async () => {
    rows.look = doneLook(LOOK);
    rows.style_sheet = sheetFor(LOOK, { status: "succeeded", image_path: "member/sheet-job.jpg" });
    // The service gives up after its deadline (pinned in generation-jobs-service-test).
    fetchImage.mockRejectedValue(new Error("The image took too long to load."));
    await mount();

    expect(screen.getByText("Your style sheet is ready, but it couldn't be loaded.")).toBeTruthy();
    expect(isDisabled(screen.getByRole("button", { name: "Retry visual" }))).toBe(false);
    expect(isDisabled(screen.getByRole("button", { name: "Try another look" }))).toBe(false);
  });

  it("is shown as still rendering, and keeps the next look from being charged on top of it", async () => {
    rows.look = doneLook(LOOK);
    rows.style_sheet = sheetFor(LOOK);
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
    rows.style_sheet = sheetFor(LOOK, {
      client_request_id: "request-2",
      status: "failed",
      error_code: "persist_failed_delivered",
    });
    await foreground();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(sheetImageOf(LOOK)).toBeTruthy();
    expect(failureCopy()).toBeNull();
  });

  it("leaves a delivered style sheet out of the slot after a restart, never failed", async () => {
    rows.look = doneLook(LOOK);
    rows.style_sheet = sheetFor(LOOK, { status: "failed", error_code: "persist_failed_delivered" });
    await mount();

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(failureCopy()).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry visual" })).toBeNull();
    expect(fetchImage).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Draw style sheet" })).toBeTruthy();
  });

  it("is not reported as a failure after a restart either", async () => {
    rememberPress("look", "request-9");
    rows.look = job({ client_request_id: "request-9", status: "failed", error_code: "persist_failed_delivered" });
    await mount();

    expect(failureCopy()).toBeNull();
    expect(screen.queryByText(/couldn't finish/)).toBeNull();
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
    await refresh();
    expect(composingProgress()).toBeTruthy();
    // Leaving would lose it today, so the screen does not promise otherwise.
    expect(screen.queryByText(/you can leave the app/i)).toBeNull();
    await answer(mockState.generate, LOOK);

    expect(screen.getByText("Linen and light")).toBeTruthy();
    expect(mockState.styleSheet.mutate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/hasn't been drawn yet/)).toBeNull();

    const readsBefore = fetchJob.mock.calls.length;
    await advance(30_000);
    expect(fetchJob.mock.calls.length).toBe(readsBefore);
  });

  it("offers no not-drawn style sheet for a look she consented to after it landed, as today", async () => {
    jobsUnavailable = true;
    mockState.profile = profile({ photo_consent_at: null });
    await mount();
    await fireEvent.press(await createButton());
    await answer(mockState.generate, LOOK);
    expect(mockState.styleSheet.mutate).not.toHaveBeenCalled();

    mockState.profile = profile();
    await refresh();

    expect(screen.queryByText(/hasn't been drawn yet/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Draw style sheet" })).toBeNull();
  });
});

describe("a press key is never forgotten while its job might still be running or unseen", () => {
  it("is resent after 31 minutes with no successful read, so the first look lands with one charge", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await fail(mockState.generate, lost());

    // Still offline: every read of her jobs fails for over half an hour.
    fetchJob.mockRejectedValue(new Error("offline"));
    await advance(31 * 60_000);
    await settle();

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockState.generate.mutate.mock.calls.map(keyOf)).toEqual(["request-1", "request-1"]);
    expect(newClientRequestId).toHaveBeenCalledTimes(1);

    // The server replays the look it already made for that key.
    await answer(mockState.generate, { ...LOOK, jobId: "look-job" });
    expect(screen.getByText("Linen and light")).toBeTruthy();
  });

  it("measures the window from the last time the key was sent", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await fail(mockState.generate, lost());

    await advance(11 * HOUR);
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await fail(mockState.generate, lost());

    // 13 h after the first send, 2 h after the last: still the same key.
    await advance(2 * HOUR);
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockState.generate.mutate.mock.calls.map(keyOf)).toEqual([
      "request-1",
      "request-1",
      "request-1",
    ]);
    expect(fetchByRequest).not.toHaveBeenCalled();
  });

  describe("past the 12 hour window, her row for the old key is asked first", () => {
    beforeEach(() => rememberPress("look", "request-old", Date.now() - 13 * HOUR));

    it.each([
      ["still running", job({ client_request_id: "request-old" })],
      ["finished", job({ client_request_id: "request-old", status: "succeeded", result: LOOK })],
    ])("resends the old key when that job is %s", async (_label, row) => {
      fetchByRequest.mockResolvedValue({ status: "ok", job: row });
      await mount();
      await fireEvent.press(await createButton());
      await settle();

      expect(fetchByRequest).toHaveBeenCalledWith("member", "look", "request-old");
      expect(mockState.generate.mutate.mock.calls.map(keyOf)).toEqual(["request-old"]);
    });

    it.each([
      ["failed", job({ client_request_id: "request-old", status: "failed" })],
      ["never arrived", null],
    ])("mints a new key when that job %s", async (_label, row) => {
      fetchByRequest.mockResolvedValue({ status: "ok", job: row });
      await mount();
      await fireEvent.press(await createButton());
      await settle();

      expect(mockState.generate.mutate.mock.calls.map(keyOf)).toEqual(["request-1"]);
    });

    it("resends the old key when its row cannot be read in time", async () => {
      fetchByRequest.mockRejectedValue(new Error("timed out"));
      await mount();
      await fireEvent.press(await createButton());
      await settle();

      expect(mockState.generate.mutate.mock.calls.map(keyOf)).toEqual(["request-old"]);
    });

    it("is asked once, and gives one key, when the screen remounts and she presses again meanwhile", async () => {
      let answerRead: (value: { status: "ok"; job: null }) => void = () => {};
      fetchByRequest.mockReturnValue(new Promise((resolve) => (answerRead = resolve)));
      await mount();
      await fireEvent.press(await createButton());
      const firstScreen = mockState.generate;

      await unmountScreen();
      freshMutations();
      await mount();
      await fireEvent.press(await createButton());

      await act(async () => answerRead({ status: "ok", job: null }));
      await settle();

      expect(fetchByRequest).toHaveBeenCalledTimes(1);
      expect(newClientRequestId).toHaveBeenCalledTimes(1);
      const keys = [...firstScreen.mutate.mock.calls, ...mockState.generate.mutate.mock.calls].map(keyOf);
      expect(new Set(keys)).toEqual(new Set(["request-1"]));
    });

    it("shows the press as composing while it asks, and a second tap sends nothing", async () => {
      let answerRead: (value: { status: "ok"; job: null }) => void = () => {};
      fetchByRequest.mockReturnValue(new Promise((resolve) => (answerRead = resolve)));
      await mount();
      await fireEvent.press(await createButton());
      expect(composingProgress()).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: /^Composing/ }));

      await act(async () => answerRead({ status: "ok", job: null }));
      await settle();
      expect(mockState.generate.mutate).toHaveBeenCalledTimes(1);
      expect(fetchByRequest).toHaveBeenCalledTimes(1);
    });
  });

  it("is kept when the phone clock (10 min ahead) calls her running job dead, and resent", async () => {
    rememberPress("look", "request-7");
    const serverNow = Date.now() - 10 * 60_000;
    rows.look = job({
      client_request_id: "request-7",
      created_at: new Date(serverNow - 60_000).toISOString(),
      deadline_at: new Date(serverNow + 4 * 60_000).toISOString(),
    });
    await mount();

    // The phone reads the job as dead, but the row never said it failed.
    expect(composingProgress()).toBeNull();
    expect(screen.queryByText(/couldn't finish/)).toBeNull();
    expect(useGenerationPressStore.getState().presses.member?.look?.map((p) => p.id)).toEqual([
      "request-7",
    ]);

    await fireEvent.press(await createButton());
    expect(mockState.generate.mutate.mock.calls.map(keyOf)).toEqual(["request-7"]);
  });

  it("sends one request when Try again is tapped twice before the screen catches up", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await fail(mockState.generate, lost());

    // The resend lands, but this render still shows the failed attempt (same key, not pending).
    mockState.generate.mutate.mockImplementationOnce((variables: unknown) => {
      mockState.generate.variables = variables;
    });
    const tryAgain = screen.getByRole("button", { name: "Try again" });
    await fireEvent.press(tryAgain);
    await fireEvent.press(tryAgain);

    expect(mockState.generate.mutate).toHaveBeenCalledTimes(2);
  });
});

describe("a look the server replayed under an old key", () => {
  it("is badged and saved with that press's own vibe and weather, not the new press's", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await fail(mockState.generate, lost());

    // She changes the vibe, then tries again: the old key is resent and replayed.
    await act(async () => useVibeStore.setState({ vibe: "Date Night" }));
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await answer(mockState.generate, { ...LOOK, jobId: "look-job" });
    await answer(mockState.styleSheet, { mode: "style_sheet", imageDataUri: IMAGE });

    expect(screen.getByText("Everyday Casual")).toBeTruthy();
    expect(screen.queryByText("Date Night")).toBeNull();
    await fireEvent.press(saveButton());
    expect(mockState.saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ vibe: "Everyday Casual", weather: "24°C Sunny (Manila)" }),
      expect.anything(),
    );
  });

  it("takes the vibe and weather from that job's row once it is read", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await fail(mockState.generate, lost());
    rows.look = job({
      client_request_id: "request-1",
      status: "succeeded",
      result: LOOK,
      look_input: { vibe: "Brunch", weather: "18°C Rain (in Manila)" },
    });

    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await answer(mockState.generate, { ...LOOK, jobId: "look-job" });
    await answer(mockState.styleSheet, { mode: "style_sheet", imageDataUri: IMAGE });

    expect(screen.getByText("Brunch")).toBeTruthy();
    await fireEvent.press(saveButton());
    expect(mockState.saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ vibe: "Brunch", weather: "18°C Rain (Manila)" }),
      expect.anything(),
    );
  });
});

describe("a look from her own press, still on screen the next morning", () => {
  it("is labelled with its time like any look from before today", async () => {
    jest.setSystemTime(new Date(2026, 9, 6, 23, 40, 0));
    await mount();
    await fireEvent.press(await createButton());
    await answer(mockState.generate, { ...LOOK, jobId: "look-job" });
    expect(screen.queryByText(/^From /)).toBeNull();

    jest.setSystemTime(new Date(2026, 9, 7, 7, 40, 0));
    await foreground();

    expect(screen.getByText("From last night, 11:40 PM")).toBeTruthy();
  });
});

describe("her presses on this phone", () => {
  it("never keep her look's words, only a fingerprint", async () => {
    await mount();
    await fireEvent.press(await createButton());
    await answer(mockState.generate, LOOK);
    await fail(mockState.styleSheet, lost());
    await settle();

    const stored = (await AsyncStorage.getItem("mila-generation-presses")) ?? "";
    expect(stored).toContain("request-2");
    expect(stored).not.toContain("Linen");
    expect(stored).not.toContain("light layer");
  });
});
