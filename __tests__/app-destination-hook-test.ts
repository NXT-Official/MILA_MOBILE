import type { Session } from "@supabase/supabase-js";
import { renderHook } from "@testing-library/react-native";

import { useAppDestination } from "@/features/auth/hooks/use-app-destination";
import { useAuthStore } from "@/stores/auth-store";

/**
 * `useProfile` refetches on every app foreground. When that refetch fails, the
 * query keeps its last good row and flips `isError` — so a member who finished
 * onboarding months ago has a complete cached profile AND an error at the same
 * moment. The launch gate used to read `isError` alone as "incomplete" and
 * routed her back into onboarding, where the same failing read left her stuck.
 *
 * These tests drive the real hook with a mocked profile query, because the
 * pure `resolveDestination` cannot see the bug: it is in how the hook turns
 * the query state into its `profileComplete` input.
 */

const mockCompleteProfile = {
  body_type: "Hourglass",
  color_season: "Autumn True",
  color_season_base: "Autumn",
  skin_undertone: "Warm",
  face_shape: "Oval",
  hair_type: "Wavy",
  gender: "Female",
  hair_length: "Long",
  skin_depth: "Medium",
  color_profile: { season: "Autumn" },
  suspended: false,
};

const mockProfileQuery = jest.fn();

jest.mock("@/hooks/use-profile", () => ({ useProfile: () => mockProfileQuery() }));

beforeEach(() => {
  mockProfileQuery.mockReset();
  useAuthStore.setState({
    session: { user: { id: "member" } } as Session,
    loading: false,
    recovery: false,
  });
});

it("keeps a member with a complete cached profile in the app when a foreground refetch fails", async () => {
  mockProfileQuery.mockReturnValue({ data: mockCompleteProfile, isPending: false, isError: true });

  const view = await renderHook(() => useAppDestination());

  expect(view.result.current).toEqual({ ready: true, destination: "/" });
});

it("still sends a member whose first profile read failed to onboarding, where it can retry", async () => {
  mockProfileQuery.mockReturnValue({ data: undefined, isPending: false, isError: true });

  const view = await renderHook(() => useAppDestination());

  expect(view.result.current).toEqual({ ready: true, destination: "/onboarding/welcome" });
});

it("sends a member with an incomplete cached profile to onboarding even when a refetch fails", async () => {
  mockProfileQuery.mockReturnValue({
    data: { ...mockCompleteProfile, hair_type: null },
    isPending: false,
    isError: true,
  });

  const view = await renderHook(() => useAppDestination());

  expect(view.result.current.destination).toBe("/onboarding/welcome");
});

it("still blocks a suspended member whose refetch failed after a good read", async () => {
  mockProfileQuery.mockReturnValue({
    data: { ...mockCompleteProfile, suspended: true },
    isPending: false,
    isError: true,
  });

  const view = await renderHook(() => useAppDestination());

  expect(view.result.current.destination).toBe("/suspended");
});

it("sends a complete, healthy member into the app", async () => {
  mockProfileQuery.mockReturnValue({ data: mockCompleteProfile, isPending: false, isError: false });

  const view = await renderHook(() => useAppDestination());

  expect(view.result.current).toEqual({ ready: true, destination: "/" });
});
