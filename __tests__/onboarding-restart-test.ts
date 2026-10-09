import { renderHook } from "@testing-library/react-native";

/**
 * "Restart Style Analysis" must start the wizard at its first question —
 * `color-path`, "Question 1 of 7" — not at the resume point. For a complete
 * profile the resume point is `refine`, the fork that offers the optional
 * extras after the seven questions; that is exactly where the restart kept
 * landing: first because the action's own `router.push` was dropped when the
 * gate unmounted it, and then because the store update that clears
 * `restartRequested` re-ran the resolver before the router reflected the new
 * route — the stale run saw the group index (`requested === undefined`) and
 * replaced the restart with the resume point.
 *
 * These tests drive the hook with the real store and a mocked router/profile,
 * at the route the member is actually on when the restart fires: the group
 * index, where `rawStep` is undefined.
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
  username: null,
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

it("a restart request from the group index starts at the first question and survives the stale resolver run", async () => {
  useOnboardingStore.setState({ restartRequested: true });

  const view = await renderHook(
    ({ step }: { step: string | undefined }) => useOnboardingMachine(step),
    { initialProps: { step: undefined as string | undefined } },
  );

  // The restart navigates to the first counted step…
  expect(mockReplace).toHaveBeenCalledWith("/onboarding/color-path");
  // …and the run that sees the cleared request — still reading the group index
  // because the router has not caught up — must not fire the resume redirect.
  expect(mockReplace).not.toHaveBeenCalledWith("/onboarding/refine");
  expect(useOnboardingStore.getState().restartRequested).toBe(false);

  // The route lands on color-path: no further navigation, and no bounce to the
  // resume point on the run that finally sees the landed step.
  mockReplace.mockClear();
  await view.rerender({ step: "color-path" });
  expect(mockReplace).not.toHaveBeenCalled();
});

it("without a restart request the group index resolves to the resume point", async () => {
  await renderHook(() => useOnboardingMachine(undefined));

  expect(mockReplace).toHaveBeenCalledWith("/onboarding/refine");
});
