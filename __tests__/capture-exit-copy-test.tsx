import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

/**
 * Leaving a capture screen asks "are you sure?" in words that have to be true.
 *
 * Both flows are paid or public the moment the request leaves the phone, and
 * neither request is cancelled when the member walks away: the mutation hooks
 * settle in the background on purpose, so a paid call is never discarded. So
 * while a request is in flight, "no credit has been used" and "nothing is
 * posted" are false, and the sheet has to say what can still happen instead.
 *
 * The mutation hooks are stubs whose in-flight state the tests choose; the
 * screens, the confirm sheet and the capture store are real.
 */
jest.mock("expo-router", () => ({ router: { back: jest.fn(), replace: jest.fn() } }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../src/components/layout/Screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../src/components/ui/Sheet", () => require("../src/test-utils/sheet-mock"));
jest.mock("../src/components/feedback/KeepAwake", () => ({ KeepAwake: () => null }));
jest.mock("../src/components/feedback/PaywallSheet", () =>
  require("../src/test-utils/paywall-sheet-mock"),
);
jest.mock("../src/services/camera", () => ({
  camera: {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    openSettings: jest.fn(),
    pickFromLibrary: jest.fn(),
  },
  CameraPreview: require("../src/test-utils/camera-preview-mock").CameraPreview,
}));
jest.mock("../src/services/api/client", () => ({
  formatRetryAfter: () => "a moment",
  resolveApiFailure: () => ({ kind: "fatal", message: "Something went wrong." }),
}));
jest.mock("../src/hooks/use-haptics", () => ({
  useHaptics: () => ({ selection: jest.fn(), success: jest.fn() }),
}));
jest.mock("../src/hooks/use-network-status", () => ({
  useNetworkStatus: () => ({ online: true }),
}));
jest.mock("../src/hooks/use-countdown", () => ({ useCountdown: () => 0 }));
jest.mock("../src/hooks/use-profile", () => ({ useProfile: () => ({ data: undefined }) }));
// The Dupe result cards carry a save bookmark; its hook reaches the Supabase
// client, which this suite never configures. Saving is not under test here.
jest.mock("../src/hooks/use-saved-products", () => ({
  useSavedProducts: () => ({ data: { status: "unavailable" } }),
  useSetProductSaved: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) =>
    select({ session: { user: { id: "member" } } }),
}));

// What the stubbed mutations report. `analyseResult` is what a finished
// analysis hands the screen; the tests flip these between renders to settle a
// request while the discard sheet is open.
const mockRun = { isPending: false, analyseResult: undefined as unknown };
const mockMutation = (data?: unknown) => ({
  isPending: mockRun.isPending,
  isError: false,
  error: null as unknown,
  data,
  mutate: jest.fn(),
  reset: jest.fn(),
});
type PublishResult = { postId: string; items: { id: string }[] };
const mockPublishMutate = jest.fn<void, [unknown, { onSuccess: (result: PublishResult) => void }]>();
const mockPublishSheet = jest.fn<void, [{ onPublish: () => void }]>();
const mockTaggingSheet = jest.fn<void, [unknown]>();
jest.mock("../src/features/lens/hooks/use-analyze-outfit", () => ({
  useAnalyzeOutfit: () => mockMutation(mockRun.analyseResult),
}));
jest.mock("../src/features/lens/hooks/use-find-dupes", () => ({
  useFindDupes: () => mockMutation(),
}));
jest.mock("../src/features/feed/hooks/use-publish-post", () => ({
  usePublishPost: () => ({ ...mockMutation(), mutate: mockPublishMutate }),
}));
jest.mock("../src/features/lens/components/AnalysisResultCard", () => ({
  AnalysisResultCard: () => null,
}));
jest.mock("../src/features/feed/components/PublishSheet", () => ({
  PublishSheet: (props: { onPublish: () => void }) => {
    mockPublishSheet(props);
    return null;
  },
}));
jest.mock("../src/features/feed/components/TaggingSheet", () => ({
  TaggingSheet: (props: unknown) => {
    mockTaggingSheet(props);
    return null;
  },
}));

import { DualCaptureScreen } from "@/features/feed/DualCaptureScreen";
import { LensCaptureScreen } from "@/features/lens/LensCaptureScreen";
import { camera } from "@/services/camera";
import { useCaptureStore } from "@/stores/capture-store";
import { stubPhoto } from "../src/test-utils/camera-preview-mock";

let client: QueryClient | null = null;

/** One client per test, so a rerender keeps the screen's state instead of remounting it. */
function withClient(node: React.ReactElement) {
  client ??= new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRun.isPending = false;
  mockRun.analyseResult = undefined;
  mockPublishMutate.mockReset();
  jest.mocked(camera.getPermission).mockResolvedValue("granted");
  jest.mocked(camera.pickFromLibrary).mockResolvedValue(stubPhoto);
  useCaptureStore.getState().reset();
});

afterEach(() => {
  client?.clear();
  client = null;
});

describe("Lens", () => {
  test("a photo that has not been sent says no credit has been used", async () => {
    const screen = await render(
      withClient(<LensCaptureScreen mode="analysis" source="gallery" />),
    );
    // The gallery opens on arrival; the review step shows once the photo lands.
    await waitFor(() => expect(screen.getByRole("button", { name: "Retake" })).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Close Lens" }));

    expect(
      screen.getByText(
        "You'll need to take it again. Nothing has been analysed yet, so no credit has been used.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
  });

  test("while Mila is reading the photo it does not claim no credit was used", async () => {
    mockRun.isPending = true;
    const screen = await render(
      withClient(<LensCaptureScreen mode="analysis" source="gallery" />),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Mila is reading your outfit")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Close Lens" }));

    expect(screen.queryByText(/no credit has been used/i)).toBeNull();
    expect(screen.queryByText(/nothing has been analysed/i)).toBeNull();
    expect(
      screen.getByText(
        "Mila may still finish reading this in the background, and a credit may still be used. If she does, the look will be in your History.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leave" })).toBeTruthy();
  });

  test("while the dupe hunt is running it says so and does not promise History", async () => {
    mockRun.isPending = true;
    const screen = await render(withClient(<LensCaptureScreen mode="dupe" source="gallery" />));
    await waitFor(() => expect(screen.getByLabelText("Mila is scanning the piece")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Close Dupe Hunter" }));

    expect(screen.queryByText(/no credit has been used/i)).toBeNull();
    expect(
      screen.getByText(
        "Mila may still finish this search in the background, and a credit may still be used.",
      ),
    ).toBeTruthy();
  });

  // The copy is chosen from the request's state, so a request that settles while
  // the sheet is open must not rewrite the sheet under her thumb: once there is
  // a result, "leave" and "discard" are both beside the point.
  async function closeMidAnalysis() {
    mockRun.isPending = true;
    const tree = () => withClient(<LensCaptureScreen mode="analysis" source="gallery" />);
    const screen = await render(tree());
    await waitFor(() =>
      expect(screen.getByLabelText("Mila is reading your outfit")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Close Lens" }));
    expect(screen.getByText("Leave while Mila reads this?")).toBeTruthy();
    return { screen, tree };
  }

  async function settleWithResult(
    screen: Awaited<ReturnType<typeof render>>,
    tree: () => React.ReactElement,
  ) {
    mockRun.isPending = false;
    mockRun.analyseResult = { analysis: { overall_score: 82 }, outfitId: "outfit-1" };
    await screen.rerender(tree());
  }

  test("a result that lands while the sheet is open closes it rather than flipping its copy", async () => {
    const { screen, tree } = await closeMidAnalysis();
    await settleWithResult(screen, tree);

    expect(screen.getByRole("button", { name: "Analyse another" })).toBeTruthy();
    expect(screen.queryByText(/nothing has been analysed/i)).toBeNull();
    expect(screen.queryByText(/no credit has been used/i)).toBeNull();
    expect(screen.queryByText("Leave while Mila reads this?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  test("starting over after that result does not bring the sheet back", async () => {
    const { screen, tree } = await closeMidAnalysis();
    await settleWithResult(screen, tree);
    await fireEvent.press(screen.getByRole("button", { name: "Analyse another" }));
    mockRun.analyseResult = undefined;
    await screen.rerender(tree());

    expect(screen.queryByText("Discard this photo?")).toBeNull();
    expect(screen.queryByText(/nothing has been analysed/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });
});

describe("DualCaptureScreen", () => {
  function holdBothPhotos() {
    useCaptureStore.getState().setBack(stubPhoto);
    useCaptureStore.getState().setFront(stubPhoto);
  }

  test("photos that have not been sent say nothing is posted", async () => {
    holdBothPhotos();
    const screen = await render(withClient(<DualCaptureScreen />));
    await act(async () => {});
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(
      screen.getByText("Your photographs are dropped and nothing is posted."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
  });

  test("while the look is being posted it does not claim nothing is posted", async () => {
    holdBothPhotos();
    mockRun.isPending = true;
    const screen = await render(withClient(<DualCaptureScreen />));
    await act(async () => {});
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByText(/nothing is posted/i)).toBeNull();
    expect(screen.queryByText(/none of it has been uploaded/i)).toBeNull();
    expect(
      screen.getByText(
        "Your look may still finish posting in the background, so it can still appear in the feed.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leave" })).toBeTruthy();
  });

  test("a post that lands while the sheet is open gives way to tagging, not to 'nothing is posted'", async () => {
    holdBothPhotos();
    mockRun.isPending = true;
    const screen = await render(withClient(<DualCaptureScreen />));
    await act(async () => {});
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("Leave while your look posts?")).toBeTruthy();

    // The post settles with a detected garment, so the tagging sheet opens.
    mockRun.isPending = false;
    mockPublishMutate.mockImplementation((_input, options) =>
      options.onSuccess({ postId: "post-1", items: [{ id: "item-1" }] }),
    );
    const publishProps = mockPublishSheet.mock.lastCall?.[0];
    await act(async () => {
      publishProps?.onPublish();
    });

    expect(mockTaggingSheet).toHaveBeenCalledWith(
      expect.objectContaining({ postId: "post-1", visible: true }),
    );
    expect(screen.queryByText(/nothing is posted/i)).toBeNull();
    expect(screen.queryByText("Leave while your look posts?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });
});
