import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { DailyLook } from "@/types/look";
import type { DashboardProfile } from "@/types/models";

/**
 * The Home screen's two promises about the window around a new look.
 *
 * 1. A member with no city is never left on a skeleton. The weather query is
 *    disabled until a hub is saved, and a disabled TanStack query is `pending`
 *    forever — so the screen has to read "loading" as "pending AND fetching",
 *    or the city picker never appears and the CTA never explains itself.
 * 2. Nothing can spend a second credit, or attach a picture to the wrong
 *    headline, while the first look's style sheet or portrait preview is still
 *    being drawn.
 *
 * The weather hook is the real one over a real query client: the bug lives in
 * what a disabled query reports, which a stub would only restate. The
 * mutations are stubs whose `mutate` records its callbacks, so a test can land
 * a result at exactly the moment it chooses. Leaf widgets that need a native
 * module (sheets, the camera widget) are stubbed; the CTA, the climate widget
 * and the action row are real.
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
  resolveApiFailure: () => ({ kind: "unknown", message: "Something went wrong." }),
}));
jest.mock("../src/services/weather", () => ({
  ...jest.requireActual("../src/services/weather"),
  fetchHubWeather: jest.fn(),
}));
// Generation jobs (R7) read as not available yet: every promise below is the
// screen's own behaviour, exactly as before the jobs existed. Recovery from
// job rows is `home-screen-recovery-test.tsx`.
jest.mock("../src/services/supabase/generation-jobs", () => ({
  fetchLatestGenerationJob: async () => ({ status: "unavailable" }),
  fetchGenerationImage: jest.fn(),
  newClientRequestId: () => "0b9d6a52-3c7e-4f8a-9d61-2f4e8c1a7b30",
}));

const mockState = {
  profile: undefined as DashboardProfile | undefined,
  online: true,
  generate: {
    data: undefined as DailyLook | undefined,
    isPending: false,
    isError: false,
    error: null as unknown,
    mutate: jest.fn(),
    reset: jest.fn(),
  },
  styleSheet: { isPending: false, mutate: jest.fn() },
  photoPreview: { isPending: false, mutate: jest.fn() },
  saveMutate: jest.fn(),
};

jest.mock("../src/hooks/use-profile", () => ({
  useProfile: () => ({ data: mockState.profile, isPending: false }),
}));
jest.mock("../src/hooks/use-outfits", () => ({
  useOutfits: () => ({ data: undefined, isPending: false, refetch: jest.fn() }),
}));
jest.mock("../src/hooks/use-network-status", () => ({
  useNetworkStatus: () => ({ online: mockState.online }),
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
import { fetchHubWeather } from "@/services/weather";

const fetchWeather = jest.mocked(fetchHubWeather);

const WEATHER = {
  label: "24°C Sunny",
  location: "Manila",
  country: "PH",
  icon: "sun",
  tempF: 75,
  tempC: 24,
  condition: "Sunny",
} as const;

function lookWithHeadline(headline: string): DailyLook {
  return {
    outfit: { headline, description: "A light layer.", styling_notes: "Roll the cuff." },
    hair: { style: "Loose waves", execution_tip: "Air dry." },
    makeup: null,
    vibe_alignment_score: 8,
  };
}

const LOOK_A = lookWithHeadline("Linen and light");
const LOOK_B = lookWithHeadline("Rain-ready layers");
const IMAGE_A = "data:image/jpeg;base64,QQ==";
const IMAGE_B = "data:image/jpeg;base64,Qg==";

function memberProfile(overrides: Partial<DashboardProfile>): DashboardProfile {
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

const clients: QueryClient[] = [];

/**
 * The stubbed hooks read `mockState` on render, so a change to it only shows
 * once the screen renders again. `refresh` is that render.
 */
let refresh: () => Promise<void> = async () => {};

async function mount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  clients.push(queryClient);
  // A new element each time: React skips a render for the very same element.
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <HomeScreen />
    </QueryClientProvider>
  );
  const view = await render(tree());
  refresh = async () => {
    await view.rerender(tree());
  };
  return view;
}

/** The CTA only carries the weather in its label once the reading has landed. */
const createButton = () => screen.findByRole("button", { name: /^Create my look —/ });
const blockedCreateButton = () => screen.getByRole("button", { name: "Create my look" });
const tryAnotherButton = () => screen.getByRole("button", { name: "Try another look" });
const saveButton = () => screen.getByRole("button", { name: "Save to history" });
const isDisabled = (button: ReturnType<typeof tryAnotherButton>) =>
  Boolean(button.props.accessibilityState?.disabled);

beforeEach(() => {
  jest.clearAllMocks();
  mockState.profile = memberProfile({});
  mockState.online = true;
  mockState.generate.data = undefined;
  mockState.generate.isPending = false;
  mockState.generate.isError = false;
  mockState.generate.error = null;
  mockState.styleSheet.isPending = false;
  mockState.photoPreview.isPending = false;
  fetchWeather.mockResolvedValue(WEATHER);
});

afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("a member with no city", () => {
  beforeEach(() => {
    mockState.profile = memberProfile({ default_location: null });
  });

  it("is offered the city picker instead of a skeleton", async () => {
    await mount();

    expect(screen.getByRole("button", { name: "Choose your city" })).toBeTruthy();
    expect(fetchWeather).not.toHaveBeenCalled();
  });

  it("is told why the look cannot be created yet", async () => {
    await mount();

    expect(isDisabled(blockedCreateButton())).toBe(true);
    expect(screen.getAllByText(/Choose a city in the weather panel/).length).toBeGreaterThan(0);
  });
});

describe("a member whose city is still loading", () => {
  it("sees the skeleton, not the picker, until the reading lands", async () => {
    fetchWeather.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(screen.queryByRole("button", { name: "Choose your city" })).toBeNull();
    expect(screen.queryByRole("button", { name: /City: Manila/ })).toBeNull();
  });
});

describe("Try another look", () => {
  /**
   * Presses the CTA, then lands `look` the way the mutation would: its
   * `onSuccess` runs, and the hook now reports the look as its data.
   */
  async function createLook(look: DailyLook, press: () => Promise<unknown>) {
    const callsBefore = mockState.generate.mutate.mock.calls.length;
    await press();
    const [, callbacks] = mockState.generate.mutate.mock.calls[callsBefore];
    mockState.generate.isPending = false;
    mockState.generate.data = look;
    await act(async () => callbacks.onSuccess(look));
    await refresh();
    return callbacks;
  }

  /** Look A is on screen, and its style sheet has been asked for. Returns that request's callbacks. */
  async function withLookOnScreen() {
    await mount();
    await createLook(LOOK_A, async () => fireEvent.press(await createButton()));
    return mockState.styleSheet.mutate.mock.calls[0][1];
  }

  it("is available once the look and its visual are settled", async () => {
    mockState.profile = memberProfile({ photo_consent_at: null });
    await mount();
    await createLook(LOOK_A, async () => fireEvent.press(await createButton()));

    expect(isDisabled(tryAnotherButton())).toBe(false);
  });

  it("is disabled while the style sheet is being drawn, and does not spend a credit", async () => {
    await withLookOnScreen();
    mockState.styleSheet.isPending = true;
    await refresh();
    mockState.generate.mutate.mockClear();

    await fireEvent.press(tryAnotherButton());

    expect(isDisabled(tryAnotherButton())).toBe(true);
    expect(mockState.generate.mutate).not.toHaveBeenCalled();
  });

  it("is disabled when the CTA is: offline, so it cannot start a look either", async () => {
    mockState.profile = memberProfile({ photo_consent_at: null });
    await mount();
    await createLook(LOOK_A, async () => fireEvent.press(await createButton()));
    mockState.online = false;
    await refresh();

    expect(isDisabled(tryAnotherButton())).toBe(true);
  });

  it("drops a style sheet that lands while the next look is still being composed", async () => {
    const sheetForA = await withLookOnScreen();

    await fireEvent.press(tryAnotherButton());
    const [, nextCallbacks] = mockState.generate.mutate.mock.calls[1];
    mockState.generate.data = undefined;
    mockState.generate.isPending = true;
    await refresh();
    await act(async () => sheetForA.onSuccess({ mode: "style_sheet", imageDataUri: IMAGE_A }));

    mockState.generate.isPending = false;
    mockState.generate.data = LOOK_B;
    await act(async () => nextCallbacks.onSuccess(LOOK_B));
    await refresh();

    // Nothing from look A may be saveable under look B's headline: B is
    // saveable text-only (the automatic save's retry path), never with A's
    // dropped sheet.
    expect(isDisabled(saveButton())).toBe(false);
    await fireEvent.press(saveButton());
    expect(mockState.saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ imageDataUri: null }),
      expect.anything(),
    );
    expect(mockState.saveMutate).not.toHaveBeenCalledWith(
      expect.objectContaining({ imageDataUri: IMAGE_A }),
      expect.anything(),
    );

    const sheetForB = mockState.styleSheet.mutate.mock.calls[1][1];
    await act(async () => sheetForB.onSuccess({ mode: "style_sheet", imageDataUri: IMAGE_B }));
    await refresh();
    // The sheet that landed for B is what the automatic save carried.
    expect(mockState.saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ imageDataUri: IMAGE_B }),
      expect.anything(),
    );
  });

  it("drops a style sheet that lands after the next look has asked for its own", async () => {
    const sheetForA = await withLookOnScreen();

    await createLook(LOOK_B, async () => fireEvent.press(tryAnotherButton()));

    await act(async () => sheetForA.onSuccess({ mode: "style_sheet", imageDataUri: IMAGE_A }));
    await refresh();

    // B is saveable text-only; A's late sheet never rides along.
    expect(isDisabled(saveButton())).toBe(false);
    await fireEvent.press(saveButton());
    expect(mockState.saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ imageDataUri: null }),
      expect.anything(),
    );
    expect(mockState.saveMutate).not.toHaveBeenCalledWith(
      expect.objectContaining({ imageDataUri: IMAGE_A }),
      expect.anything(),
    );
  });

  describe("while a portrait preview is being drawn", () => {
    it("is disabled, and does not spend a credit", async () => {
      await withLookOnScreen();
      mockState.photoPreview.isPending = true;
      await refresh();
      mockState.generate.mutate.mockClear();

      await fireEvent.press(tryAnotherButton());

      expect(isDisabled(tryAnotherButton())).toBe(true);
      expect(mockState.generate.mutate).not.toHaveBeenCalled();
    });

    it("keeps Create my look disabled, with the reason on screen", async () => {
      await withLookOnScreen();
      mockState.photoPreview.isPending = true;
      await refresh();
      mockState.generate.mutate.mockClear();

      const cta = await createButton();
      await fireEvent.press(cta);

      expect(isDisabled(cta)).toBe(true);
      expect(mockState.generate.mutate).not.toHaveBeenCalled();
      expect(screen.getAllByText("Your look is still rendering. One moment.").length).toBeGreaterThan(0);
    });

    it("lets both go again once the preview has settled", async () => {
      await withLookOnScreen();
      mockState.photoPreview.isPending = true;
      await refresh();
      mockState.photoPreview.isPending = false;
      await refresh();

      expect(isDisabled(tryAnotherButton())).toBe(false);
      expect(isDisabled(await createButton())).toBe(false);
    });
  });

  describe("a portrait preview for a look she has moved on from", () => {
    const previewButton = () => screen.getByRole("button", { name: "Generate portrait preview" });

    /** Look A's preview is in flight, then look B is on screen and has asked for its own. */
    async function withPreviewsForBothLooks() {
      await withLookOnScreen();
      await fireEvent.press(previewButton());
      const previewForA = mockState.photoPreview.mutate.mock.calls[0][1];

      await createLook(LOOK_B, async () => fireEvent.press(tryAnotherButton()));
      await fireEvent.press(previewButton());
      const previewForB = mockState.photoPreview.mutate.mock.calls[1][1];

      return { previewForA, previewForB };
    }

    it("is dropped when it lands, so it is never saved under the new headline", async () => {
      const { previewForA, previewForB } = await withPreviewsForBothLooks();

      await act(async () => previewForA.onSuccess({ mode: "photo_edit", imageDataUri: IMAGE_A }));
      await refresh();
      // B is saveable text-only; A's dropped preview never rides along.
      expect(isDisabled(saveButton())).toBe(false);
      await fireEvent.press(saveButton());
      expect(mockState.saveMutate).toHaveBeenCalledWith(
        expect.objectContaining({ imageDataUri: null }),
        expect.anything(),
      );
      expect(mockState.saveMutate).not.toHaveBeenCalledWith(
        expect.objectContaining({ imageDataUri: IMAGE_A }),
        expect.anything(),
      );

      await act(async () => previewForB.onSuccess({ mode: "photo_edit", imageDataUri: IMAGE_B }));
      await refresh();
      await fireEvent.press(saveButton());
      expect(mockState.saveMutate).toHaveBeenCalledWith(
        expect.objectContaining({ imageDataUri: IMAGE_B }),
        expect.anything(),
      );
    });

    it("does not report its failure under the new look", async () => {
      const { previewForA, previewForB } = await withPreviewsForBothLooks();

      await act(async () => previewForA.onError(new Error("render failed")));
      await refresh();
      expect(screen.queryByText("Something went wrong.")).toBeNull();

      await act(async () => previewForB.onError(new Error("render failed")));
      await refresh();
      expect(screen.getByText("Something went wrong.")).toBeTruthy();
    });
  });
});
