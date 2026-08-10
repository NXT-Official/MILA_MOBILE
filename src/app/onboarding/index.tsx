import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";

/**
 * The group's landing route, so `Stack.Protected` has a concrete screen to fall
 * back to when the session gate opens onboarding — a bare `[step].tsx` is
 * dynamic and cannot be navigated to without a param.
 *
 * No step is requested, so the machine resolves the resume point and replaces
 * the URL with it. That is the same path a cold start takes.
 */
export default function OnboardingIndexRoute() {
  return <OnboardingScreen rawStep={undefined} />;
}
