import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { sanitizeOnboardingStep, type OnboardingStepId } from "@/constants/steps";
import { useProfile } from "@/hooks/use-profile";
import type { DashboardProfile } from "@/types/models";

import { nextStep, previousStep, resolveStep } from "../machine";

/**
 * Binds the pure machine to the router.
 *
 * The resume redirect fires ONCE per mount, on the first settled profile. Doing
 * it on every render would fight the member every time she taps Back — the
 * profile still says the later step is complete, so she would be thrown forward
 * again.
 */
export function useOnboardingMachine(rawStep: string | undefined) {
  const router = useRouter();
  const { data: profile, isPending, isFetching, isError, refetch } = useProfile();

  const requested = sanitizeOnboardingStep(rawStep);
  // `isFetching` matters as much as `isPending`: a step is pushed immediately
  // after its answer is saved, and judging reachability against a profile that
  // is mid-refetch would bounce her back to the step she just finished.
  const settled = !isPending && !isFetching && !isError;

  const goTo = useCallback(
    (step: OnboardingStepId, options?: { replace?: boolean }) => {
      const href = `/onboarding/${step}` as const;
      if (options?.replace) router.replace(href);
      else router.push(href);
    },
    [router],
  );

  const resolvedRef = useRef(false);
  useEffect(() => {
    if (!settled || resolvedRef.current) return;
    resolvedRef.current = true;

    const { step, redirected } = resolveStep(requested, profile);
    if (redirected) goTo(step, { replace: true });
  }, [settled, requested, profile, goTo]);

  return {
    /** Undefined until the router has a valid step — the screen shows loading. */
    step: requested,
    profile: (profile ?? null) as DashboardProfile | null,
    loading: isPending || !requested,
    error: isError,
    refetch,
    goTo,
    goNext: (from: OnboardingStepId) => {
      const to = nextStep(from);
      if (to) goTo(to);
    },
    goBack: (from: OnboardingStepId) => {
      // Pop when there is something to pop — Back should shorten the stack, not
      // grow it, and popping keeps the Android hardware back button in step.
      if (router.canGoBack()) {
        router.back();
        return;
      }
      // Nothing to pop: she arrived by deep link or by the resume redirect.
      const to = previousStep(from);
      if (to) goTo(to, { replace: true });
    },
  };
}
