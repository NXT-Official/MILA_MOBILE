import { renderHook } from "@testing-library/react-native";

/**
 * "Restart Style Analysis" must start the wizard at its first counted step —
 * `color-path`, "Step 1 of 15" — not at the resume point. For a complete
 * profile the resume point is `beauty-preferences` ("Step 11 of 15"), which is
 * exactly where the restart landed before the store-carried request existed
 * (the action's own `router.push` was dropped when the gate unmounted it).
 *
 * These tests drive the hook with the real store and a mocked router/profile:
 * the request is consumed once, navigation goes to color-path, and without a
 * request the resume contract stands.
 */

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, canGoBack: () => false }),
}));

const mockCompleteProfile = {
  body_type: "Hourglass",
  color_season: "Autumn True",
  color_season_base: "Autumn",
  skin_undertone: "Warm",
  full_name: "Member",
  face_shape: "Oval",
  hair_type: "Wavy",
  gender: "Female",
  hair_length: "Long",
  makeup_preference: "Natural",
  shopping_preferences: [],
  styling_constraints: [],
  delivery_country: "AE",
  beauty_preferences: [],
  color_profile: { season: "Autumn" },
  default_location: "dubai",
  style_goals: [],
  suspended: false,
  photo_consent_at: null,
  profile_photo_path: null,
  skin_depth: "Medium",
  height_cm: 165,
  weight_kg: 55,
};

jest.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    data: mockCompleteProfile,
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

import { useOnboardingMachine } from "@/features/onboarding/hooks/use-onboarding-machine";
import { useOnboardingStore } from "@/stores/onboarding-store";

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  useOnboardingStore.setState({
    pending: null,
    candidate: null,
    active: false,
    restartRequested: false,
    hydrated: true,
  });
});

it("a restart request starts the wizard at the first counted step (1/15), not the resume point", async () => {
  useOnboardingStore.setState({ restartRequested: true });

  await renderHook(() => useOnboardingMachine("beauty-preferences"));

  expect(mockReplace).toHaveBeenCalledWith("/onboarding/color-path");
  expect(useOnboardingStore.getState().restartRequested).toBe(false);
});

it("without a restart request the resume point stands — beauty-preferences, not step 1", async () => {
  await renderHook(() => useOnboardingMachine("beauty-preferences"));

  expect(mockReplace).not.toHaveBeenCalled();
});
