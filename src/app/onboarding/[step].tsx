import { useLocalSearchParams } from "expo-router";

import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";

/**
 * One route, nine steps. The route reads the param and renders the screen —
 * no fetch, no schema, no business rule lives here.
 */
export default function OnboardingStepRoute() {
  const { step } = useLocalSearchParams<{ step: string }>();
  return <OnboardingScreen rawStep={step} />;
}
