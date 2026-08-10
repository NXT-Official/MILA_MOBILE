import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { ErrorState } from "@/components/ui/ErrorState";
import {
  getFirstIncompleteOnboardingStep,
  type OnboardingStepId,
} from "@/constants/steps";
import {
  BODY_OPTIONS,
  FACE_SHAPE_OPTIONS,
  HAIR_TYPE_OPTIONS,
  type DetailedColorProfile as StudioDossier,
  type MatrixOption,
} from "@/constants/style-profile";
import { isStyleProfileComplete, toStyleProfileRow } from "@/lib/style-profile/completion";
import { normalizeBeautyPreferences } from "@/lib/beauty-preferences";
import { normalizeStoredProfile } from "@/lib/style-profile/studio-dossier";
import { useOnboardingStore } from "@/stores/onboarding-store";
import type { Json } from "@/types/models";

import { useAutoSaveProfile } from "./hooks/use-auto-save-profile";
import { useOnboardingMachine } from "./hooks/use-onboarding-machine";
import { BeautyPreferences } from "./steps/BeautyPreferences";
import { ColorPath } from "./steps/ColorPath";
import { ColorResult } from "./steps/ColorResult";
import { Location } from "./steps/Location";
import { Review } from "./steps/Review";
import { SingleSelect } from "./steps/SingleSelect";
import { Welcome } from "./steps/Welcome";

/**
 * The single onboarding screen. Nine route files would duplicate the shell,
 * the progress bar, and the autosave nine times; one screen driven by the
 * copied step machine keeps them in one place.
 */

const SELECT_STEPS = {
  "body-type": {
    field: "body_type",
    options: BODY_OPTIONS,
    guidance:
      "Choose the shape that most closely describes how your shoulders, waist, and hips relate to one another. This drives every cut, drape, and proportion recommendation — there is no wrong answer.",
    requiredMessage: "Select a body silhouette to continue.",
  },
  "face-shape": {
    field: "face_shape",
    options: FACE_SHAPE_OPTIONS,
    guidance:
      "Pick whichever shape reads closest — Mila uses this to guide hairstyling, eyewear, and framing suggestions. You can refine it later.",
    requiredMessage: "Select a face shape to continue.",
  },
  "hair-type": {
    field: "hair_type",
    options: HAIR_TYPE_OPTIONS,
    guidance:
      "This shapes the silhouette of every hair direction Mila composes, from styling to product suggestions.",
    requiredMessage: "Select a hair type to continue.",
  },
} as const satisfies Record<
  string,
  {
    field: "body_type" | "face_shape" | "hair_type";
    options: MatrixOption[];
    guidance: string;
    requiredMessage: string;
  }
>;

export function OnboardingScreen({ rawStep }: { rawStep: string | undefined }) {
  const router = useRouter();

  const { step, profile, loading, error, refetch, goTo, goNext, goBack } =
    useOnboardingMachine(rawStep);

  // The hook keys its draft on the step, so it is safe to call before `step`
  // resolves — "welcome" writes nothing.
  const autoSave = useAutoSaveProfile(step ?? "welcome");

  // The chosen season lives in the store, not in useState: advancing a step
  // mounts a new screen, so component state does not survive the trip from
  // color-path to color-result.
  const candidate = useOnboardingStore((s) => s.candidate);
  const setCandidate = useOnboardingStore((s) => s.setCandidate);
  const clearCandidate = useOnboardingStore((s) => s.clearCandidate);
  // AsyncStorage rehydrates asynchronously. Rendering before it lands would
  // flash "No colour result yet" on a cold start into color-result.
  const draftHydrated = useOnboardingStore((s) => s.hydrated);

  // Latches the launch gate open for the whole flow — see the store's `active`.
  // Cleared only by `handleComplete`, so the exit is hers, not a side effect of
  // answering the last required question.
  const enterOnboarding = useOnboardingStore((s) => s.enterOnboarding);
  const exitOnboarding = useOnboardingStore((s) => s.exitOnboarding);
  useEffect(() => {
    enterOnboarding();
  }, [enterOnboarding]);

  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  if (loading || !draftHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !step) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ErrorState
          title="We couldn't load your profile"
          description="Check your connection and try again — nothing you have answered is lost."
          actionLabel="Try again"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const dossier: StudioDossier | null = normalizeStoredProfile(profile?.color_profile);
  const selectStep = SELECT_STEPS[step as keyof typeof SELECT_STEPS];

  /**
   * The exit. Re-reads the profile from the server rather than trusting the
   * cache: the gate that decides whether she is done must agree with the gate
   * the root layout will run one render later, or she bounces back here.
   */
  async function handleComplete() {
    setCompleting(true);
    setCompletionError(null);
    try {
      const { data: fresh, error: refetchError } = await refetch();
      if (refetchError || !fresh) throw refetchError ?? new Error("No profile");

      if (!isStyleProfileComplete(toStyleProfileRow(fresh))) {
        const firstIncomplete = getFirstIncompleteOnboardingStep(fresh);
        setCompletionError(
          "A few required steps still need your input — taking you back to finish them.",
        );
        goTo(firstIncomplete === "welcome" ? "color-path" : firstIncomplete, { replace: true });
        return;
      }

      exitOnboarding();
      router.replace("/");
    } catch {
      setCompletionError("We couldn't confirm your profile just now. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  if (step === "welcome") {
    return <Welcome onBegin={() => goNext("welcome")} />;
  }

  if (step === "color-path") {
    return (
      <ColorPath
        existingDossier={dossier}
        onBack={() => goBack("color-path")}
        onCandidateReady={(next) => {
          setCandidate(next);
          goNext("color-path");
        }}
        onContinueExisting={() => {
          clearCandidate();
          goNext("color-path");
        }}
      />
    );
  }

  if (step === "color-result") {
    return (
      <ColorResult
        candidate={candidate}
        existingDossier={dossier}
        onBack={() => goBack("color-result")}
        onChooseAnother={() => {
          clearCandidate();
          goTo("color-path", { replace: true });
        }}
        onConfirmed={() => {
          // Confirmed means it is now in `profiles.color_profile`; keeping the
          // draft too would give a later visit two sources for one answer.
          clearCandidate();
          goNext("color-result");
        }}
        save={(payload) => autoSave.save(payload)}
        saveState={autoSave.state}
        onRetrySave={autoSave.retry}
        saving={autoSave.saving}
      />
    );
  }

  if (selectStep) {
    return (
      <SingleSelect
        key={step}
        step={step}
        value={profile?.[selectStep.field] ?? null}
        options={selectStep.options}
        guidance={selectStep.guidance}
        requiredMessage={selectStep.requiredMessage}
        onBack={() => goBack(step)}
        onSaved={() => goNext(step)}
        save={(value) => autoSave.save({ [selectStep.field]: value })}
        saveState={autoSave.state}
        onRetrySave={autoSave.retry}
        saving={autoSave.saving}
      />
    );
  }

  if (step === "beauty-preferences") {
    return (
      <BeautyPreferences
        value={normalizeBeautyPreferences(profile?.beauty_preferences)}
        onBack={() => goBack("beauty-preferences")}
        onSaved={() => goNext("beauty-preferences")}
        onSkip={() => goNext("beauty-preferences")}
        save={(preferences: Json) => autoSave.save({ beauty_preferences: preferences })}
        saveState={autoSave.state}
        onRetrySave={autoSave.retry}
        saving={autoSave.saving}
      />
    );
  }

  if (step === "location") {
    return (
      <Location
        value={profile?.default_location ?? null}
        onBack={() => goBack("location")}
        onSaved={() => goNext("location")}
        onSkip={() => goNext("location")}
        save={(hubId) => autoSave.save({ default_location: hubId })}
        saveState={autoSave.state}
        onRetrySave={autoSave.retry}
        saving={autoSave.saving}
      />
    );
  }

  return (
    <Review
      profile={profile as NonNullable<typeof profile>}
      dossier={dossier}
      onBack={() => goBack("review")}
      onEdit={(target: OnboardingStepId) => goTo(target)}
      onComplete={handleComplete}
      completing={completing}
      completionError={completionError}
    />
  );
}
