jest.mock("../src/services/camera", () => ({
  camera: {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    openSettings: jest.fn(),
    pickFromLibrary: jest.fn(),
  },
  CameraPreview: require("../src/test-utils/camera-preview-mock").CameraPreview,
}));
jest.mock("../src/services/api/analysis", () => ({ analyzePersonalColor: jest.fn() }));
jest.mock("../src/services/supabase/client", () => ({
  supabase: { auth: { getSession: jest.fn(), refreshSession: jest.fn() } },
}));
jest.mock("../src/components/feedback/PaywallSheet", () =>
  require("../src/test-utils/paywall-sheet-mock"),
);
jest.mock("../src/hooks/use-haptics", () => ({
  useHaptics: () => ({ selection: jest.fn(), success: jest.fn() }),
}));
jest.mock("../src/stores/auth-store", () => ({
  useAuthStore: (select: (state: { session: { user: { id: string } } }) => unknown) =>
    select({ session: { user: { id: "member" } } }),
}));
jest.mock("expo-file-system", () => ({
  File: class {
    async base64() {
      return "QkFTRTY0";
    }
  },
}));
jest.mock("../src/constants/env", () => ({
  env: {
    API_BASE_URL: "https://api.test",
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable",
    HCAPTCHA_SITEKEY: "sitekey",
  },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { PersonalColorCapture } from "@/features/onboarding/components/PersonalColorCapture";
import { analyzePersonalColor } from "@/services/api/analysis";
import { camera } from "@/services/camera";
import type { PersonalColorAnalysisResult, StudioColorProfile } from "@/types/models";

const getPermission = jest.mocked(camera.getPermission);
const analyze = jest.mocked(analyzePersonalColor);

const PROFILE = { season: "Spring", subSeason: "Spring Light" } as unknown as StudioColorProfile;
const SUCCESS = {
  success: true,
  profile: PROFILE,
  telemetry: {
    pass1Raw: {
      ambientLighting: "clear_daylight",
      biologicalUndertone: "warm_peach",
      computedContrast: "medium",
    },
    interceptTriggered: false,
    gatekeeperNotes: [],
    pass2OverrideInputs: {
      ambientLighting: "clear_daylight",
      biologicalUndertone: "warm_peach",
      computedContrast: "medium",
      sensorClippingEvent: false,
    },
    forcedDiagnostic: false,
  },
} as PersonalColorAnalysisResult;

async function mount() {
  const onComplete = jest.fn();
  const onClose = jest.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <PersonalColorCapture onComplete={onComplete} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { screen, onComplete, onClose, queryClient };
}

type Screen = Awaited<ReturnType<typeof mount>>["screen"];

async function openCamera(screen: Screen) {
  await fireEvent.press(screen.getByText(/soft, indirect natural daylight/));
  await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
}

beforeEach(() => {
  jest.clearAllMocks();
  getPermission.mockResolvedValue("granted");
  jest.mocked(camera.requestPermission).mockResolvedValue("granted");
  jest.mocked(camera.openSettings).mockResolvedValue(undefined);
  jest.mocked(camera.pickFromLibrary).mockResolvedValue(null);
});

test("the camera only opens after the light check", async () => {
  const { screen } = await mount();

  // The un-checked briefing: pressing the button changes nothing.
  await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
  expect(screen.queryByText("Studio camera")).toBeNull();

  await fireEvent.press(screen.getByText(/soft, indirect natural daylight/));
  await fireEvent.press(screen.getByRole("button", { name: "Open the camera" }));
  expect(screen.getByText("Studio camera")).toBeTruthy();
});

test("capturing runs the live read and hands the profile back", async () => {
  analyze.mockResolvedValue(SUCCESS);
  const { screen, onComplete } = await mount();

  await openCamera(screen);
  await fireEvent.press(screen.getByLabelText("Take a photo"));

  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(PROFILE));
  expect(analyze).toHaveBeenCalledWith({ imageBase64: "QkFTRTY0" });
});

test("a rate-limited read lands on the failure screen with retry and the manual path", async () => {
  analyze.mockResolvedValue({
    success: false,
    error: "ANALYSIS_RATE_LIMITED",
  } as PersonalColorAnalysisResult);
  const { screen, onComplete } = await mount();

  await openCamera(screen);
  await fireEvent.press(screen.getByLabelText("Take a photo"));

  await waitFor(() => expect(screen.getByText(/hourly limit for studio readings/)).toBeTruthy());
  expect(onComplete).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Choose my season instead" })).toBeTruthy();
});

test("out of credits opens the paywall sheet, never a generic error", async () => {
  analyze.mockResolvedValue({
    success: false,
    error: "INSUFFICIENT_CREDITS",
  } as PersonalColorAnalysisResult);
  const { screen } = await mount();

  await openCamera(screen);
  await fireEvent.press(screen.getByLabelText("Take a photo"));

  await waitFor(() => expect(screen.getByText("paywall stub")).toBeTruthy());
});

test("after the paywall is dismissed she is told her credits reset, not that a membership will refresh them", async () => {
  analyze.mockResolvedValue({
    success: false,
    error: "ANALYSIS_CREDITS_EXHAUSTED",
  } as PersonalColorAnalysisResult);
  const { screen } = await mount();

  await openCamera(screen);
  await fireEvent.press(screen.getByLabelText("Take a photo"));
  await waitFor(() => expect(screen.getByText("paywall stub")).toBeTruthy());
  await fireEvent.press(screen.getByLabelText("Dismiss paywall"));

  expect(screen.getByText("You're out of studio credits for today. They reset tomorrow.")).toBeTruthy();
  expect(screen.queryByText(/membership refreshes/i)).toBeNull();
  expect(screen.queryByText(/ANALYSIS_/)).toBeNull();
  expect(screen.getByRole("button", { name: "Choose my season instead" })).toBeTruthy();
});
