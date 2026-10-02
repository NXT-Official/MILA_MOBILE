import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { sanitizeOnboardingStep, type OnboardingStepId } from "@/constants/steps";
import { useProfile } from "@/hooks/use-profile";
import { useOnboardingStore } from "@/stores/onboarding-store";
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

  const restartRequested = useOnboardingStore((s) => s.restartRequested);
  const clearRestart = useOnboardingStore((s) => s.clearRestart);

  const goTo = useCallback(
    (step: OnboardingStepId, options?: { replace?: boolean }) => {
      const href = `/onboarding/${step}` as const;
      if (options?.replace) router.replace(href);
      else router.push(href);
    },
    [router],
  );

  // Keyed on the requested step, NOT on the mount. A deep link to another step
  // updates this route's params in place instead of remounting, so a
  // once-per-mount guard would already have fired and would wave the new step
  // straight through — which is how `/onboarding/review` rendered a dossier of
  // "Not set" on a blank profile.
  //
  // Still a guard rather than an unconditional check: without it, a background
  // refetch that briefly returns a stale profile would throw a member backwards
  // out of the step she is standing on.
  const resolvedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!settled) return;

    // "Restart Style Analysis" asks for the wizard from its first question,
    // not the resume point — and it asks from a component the gate unmounts
    // in the same commit, so the request travels through the store instead of
    // a router call from the action itself. Consumed once, before the
    // resume-point logic below can decide anything else.
    if (restartRequested) {
      clearRestart();
      goTo("gender", { replace: true });
      return;
    }

    const key = requested ?? "";
    if (resolvedForRef.current === key) return;
    resolvedForRef.current = key;

    const { step, redirected } = resolveStep(requested, profile);
    // Terminates after one hop: resolveStep only ever returns the resume point,
    // which is reachable by construction (asserted in the machine tests).
    if (redirected) goTo(step, { replace: true });
  }, [settled, restartRequested, clearRestart, requested, profile, goTo]);

  return {
    /** Undefined until the router has a valid step — the screen shows loading. */
    step: requested,
    profile: (profile ?? null) as DashboardProfile | null,
    loading: isPending || !requested,
    error: isError,
    refetch,
    goTo,
    goNext: (from: OnboardingStepId) => {
      const to = nextStep(from, profile);
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
      const to = previousStep(from, profile);
      if (to) goTo(to, { replace: true });
    },
  };
}
