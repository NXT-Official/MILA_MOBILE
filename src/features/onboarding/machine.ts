import {
  ONBOARDING_STEPS,
  getFirstIncompleteOnboardingStep,
  isOnboardingStepReachable,
  type OnboardingStepId,
} from "@/constants/steps";
import type { DashboardProfile } from "@/types/models";

/**
 * Order, reachability, and the resume point all come from the copied
 * `constants/steps.ts`. This file adds only what the web spells out per screen
 * instead of deriving: which step is next, and which is back.
 *
 * Pure — no React, no I/O — so the whole flow is testable without a renderer.
 */

/**
 * The undertone written alongside the season on the colour-result step. Copied
 * from the web's `color-result-step.tsx`: Spring and Autumn are the warm
 * families, everything else is cool.
 *
 * Lives here rather than in the step body because it is the only reason
 * `skin_undertone` ends up valid against UNDERTONES — one of the six fields the
 * completion gate requires — and that deserves a test, not a JSX file.
 */
export function undertoneForSeason(season: string): string {
  return (["Spring", "Autumn"] as string[]).includes(season) ? "Warm" : "Cool";
}

export function nextStep(
  step: OnboardingStepId,
  profile?: { gender?: string | null } | null,
): OnboardingStepId | null {
  // The web's `SELECT_STEPS["measurements"].next` is conditional: makeup-
  // ineligible members skip `makeup-preference` entirely rather than seeing it
  // and being bounced. Mirrored here so the sequence is the same whether she
  // taps Continue or deep-links ahead.
  if (step === "measurements" && profile?.gender === "Male") return "beauty-preferences";
  const index = ONBOARDING_STEPS.findIndex((s) => s.id === step);
  return ONBOARDING_STEPS[index + 1]?.id ?? null;
}

export function previousStep(
  step: OnboardingStepId,
  profile?: { gender?: string | null } | null,
): OnboardingStepId | null {
  // The web's `BeautyPreferencesStep.onBack` — same skip, walked backwards.
  // Without this, Back from `beauty-preferences` on a no-stack deep link lands
  // on `makeup-preference`, which redirects straight forward again.
  if (step === "beauty-preferences" && profile?.gender === "Male") return "measurements";
  const index = ONBOARDING_STEPS.findIndex((s) => s.id === step);
  return index > 0 ? ONBOARDING_STEPS[index - 1].id : null;
}

/**
 * The one guard the router asks. An unreachable step — a deep link into
 * `review` on a blank profile, or a step whose answer was since cleared — is
 * redirected to the resume point rather than rendered empty.
 */
export function resolveStep(
  requested: OnboardingStepId | undefined,
  profile: DashboardProfile | null | undefined,
): { step: OnboardingStepId; redirected: boolean } {
  if (requested && isOnboardingStepReachable(requested, profile)) {
    return { step: requested, redirected: false };
  }
  return { step: getFirstIncompleteOnboardingStep(profile), redirected: true };
}
