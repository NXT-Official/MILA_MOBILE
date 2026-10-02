jest.mock("../src/services/supabase/client", () => ({
  supabase: { from: jest.fn() },
}));
jest.mock("../src/services/supabase/storage", () => ({
  getSignedProfilePhotoUrl: jest.fn(), removeProfilePhoto: jest.fn(), uploadProfilePhoto: jest.fn(),
}));

import { supabase } from "@/services/supabase/client";
import { fetchProfile } from "@/services/supabase/profile";
import { getFirstIncompleteOnboardingStep } from "@/constants/steps";
import { isStyleProfileComplete, toStyleProfileRow } from "@/lib/style-profile/completion";

function mockProfile(face: string | null, colorProfile: { calibrationSource?: string; detectedLighting?: string }) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: {
    color_profile: { season: "Winter", subSeason: "True Winter", faceShape: "Oval Frame", ...colorProfile },
    skin_undertone: "Cool", color_season: "Winter", face_shape: face,
    body_type: "Hourglass", hair_type: "Straight", hair_length: "Long", gender: "Female", skin_depth: "Light",
  }, error: null });
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle };
  jest.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
}

test.each([
  { calibrationSource: "Studio Calibrated" },
  { detectedLighting: "Manual Studio Calibration" },
])("manual season's template face never completes required onboarding answer: %p", async (source) => {
  mockProfile(null, source);
  const profile = await fetchProfile("member");
  expect(profile.face_shape).toBeNull();
  expect(isStyleProfileComplete(toStyleProfileRow(profile))).toBe(false);
  expect(getFirstIncompleteOnboardingStep(profile)).toBe("face-shape");
});

test("member's saved face wins even with a manual palette", async () => {
  mockProfile("Square", { calibrationSource: "Studio Calibrated" });
  expect((await fetchProfile("member")).face_shape).toBe("Square");
});

test("legacy AI reading still fills a missing face column", async () => {
  mockProfile(null, { calibrationSource: "AI Vision" });
  expect((await fetchProfile("member")).face_shape).toBe("Oval");
});
