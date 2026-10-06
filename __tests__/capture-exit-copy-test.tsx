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
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) =>
    select({ session: { user: { id: "member" } } }),
}));

const mockRun = { isPending: false, isError: false, error: null as unknown, data: undefined };
const mockMutation = () => ({
  ...mockRun,
  mutate: jest.fn(),
  reset: jest.fn(),
});
jest.mock("../src/features/lens/hooks/use-analyze-outfit", () => ({
  useAnalyzeOutfit: () => mockMutation(),
}));
jest.mock("../src/features/lens/hooks/use-find-dupes", () => ({
  useFindDupes: () => mockMutation(),
}));
jest.mock("../src/features/feed/hooks/use-publish-post", () => ({
  usePublishPost: () => mockMutation(),
}));
jest.mock("../src/features/feed/components/PublishSheet", () => ({ PublishSheet: () => null }));
jest.mock("../src/features/feed/components/TaggingSheet", () => ({ TaggingSheet: () => null }));

import { DualCaptureScreen } from "@/features/feed/DualCaptureScreen";
import { LensCaptureScreen } from "@/features/lens/LensCaptureScreen";
import { camera } from "@/services/camera";
import { useCaptureStore } from "@/stores/capture-store";
import { stubPhoto } from "../src/test-utils/camera-preview-mock";

const clients: QueryClient[] = [];

function withClient(node: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  clients.push(queryClient);
  return <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRun.isPending = false;
  jest.mocked(camera.getPermission).mockResolvedValue("granted");
  jest.mocked(camera.pickFromLibrary).mockResolvedValue(stubPhoto);
  useCaptureStore.getState().reset();
});

afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
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
});
