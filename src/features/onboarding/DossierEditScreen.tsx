import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { ErrorState } from "@/components/ui/ErrorState";
import {
  BODY_OPTIONS,
  FACE_SHAPE_OPTIONS,
  HAIR_TYPE_OPTIONS,
  type DetailedColorProfile as StudioDossier,
  type MatrixOption,
} from "@/constants/style-profile";
import type { OnboardingStepId } from "@/constants/steps";
import { useProfile } from "@/hooks/use-profile";
import { normalizeBeautyPreferences } from "@/lib/beauty-preferences";
import { normalizeStoredProfile } from "@/lib/style-profile/studio-dossier";
import { useOnboardingStore } from "@/stores/onboarding-store";
import type { Json } from "@/types/models";

import { useAutoSaveProfile } from "./hooks/use-auto-save-profile";
import { BeautyPreferences } from "./steps/BeautyPreferences";
import { ColorPath } from "./steps/ColorPath";
import { ColorResult } from "./steps/ColorResult";
import { Location } from "./steps/Location";
import { SingleSelect } from "./steps/SingleSelect";

/**
 * Editing one dossier answer from Studio.
 *
 * **It reuses the onboarding step components** rather than reimplementing them
 * (§3): a second body-type picker is a second place for the option list, the
 * copy, and the save semantics to drift. Only the shell differs — saving
 * returns to Studio instead of advancing to the next step.
 *
 * It lives in `features/onboarding/` because it *is* those steps, and a feature
 * may never import another feature's internals (§5). Studio reaches it by
 * pushing a route, which is not an import.
 *
 * It is also deliberately **outside** the `/onboarding` route group. That group
 * is hidden by `Stack.Protected` once a profile is complete, and entering it
 * would mean latching `onboardingActive` — flipping the launch gate and
 * unmounting the tabs underneath her for the sake of one edit.
 */
const SELECT_FIELDS = {
  "body-type": {
    step: "body-type" as OnboardingStepId,
    field: "body_type" as const,
    options: BODY_OPTIONS,
    guidance:
      "Choose the shape that most closely describes how your shoulders, waist, and hips relate to one another. This drives every cut, drape, and proportion recommendation — there is no wrong answer.",
    requiredMessage: "Select a body silhouette to continue.",
  },
  "face-shape": {
    step: "face-shape" as OnboardingStepId,
    field: "face_shape" as const,
    options: FACE_SHAPE_OPTIONS,
    guidance:
      "Pick whichever shape reads closest — Mila uses this to guide hairstyling, eyewear, and framing suggestions. You can refine it later.",
    requiredMessage: "Select a face shape to continue.",
  },
  "hair-type": {
    step: "hair-type" as OnboardingStepId,
    field: "hair_type" as const,
    options: HAIR_TYPE_OPTIONS,
    guidance:
      "This shapes the silhouette of every hair direction Mila composes, from styling to product suggestions.",
    requiredMessage: "Select a hair type to continue.",
  },
} as const satisfies Record<
  string,
  {
    step: OnboardingStepId;
    field: "body_type" | "face_shape" | "hair_type";
    options: MatrixOption[];
    guidance: string;
    requiredMessage: string;
  }
>;

export type DossierField =
  | keyof typeof SELECT_FIELDS
  | "beauty-preferences"
  | "location"
  | "color";

/**
 * `location` is reached from Settings rather than Studio, but it is the same
 * step and the same save — including the rule that a device fix is confirmed
 * before it is written (§7). Routing it here is what keeps that rule in one
 * place instead of two.
 */

export function DossierEditScreen({ field }: { field: string }) {
  const { data: profile, isPending, isError, refetch } = useProfile();

  /** The colour path is two steps; the rest are one. */
  const [colorStep, setColorStep] = useState<"path" | "result">("path");

  const candidate = useOnboardingStore((s) => s.candidate);
  const setCandidate = useOnboardingStore((s) => s.setCandidate);
  const clearCandidate = useOnboardingStore((s) => s.clearCandidate);

  const select = SELECT_FIELDS[field as keyof typeof SELECT_FIELDS];
  const autoSave = useAutoSaveProfile(
    select
      ? select.step
      : field === "color"
        ? "color-result"
        : field === "location"
          ? "location"
          : "beauty-preferences",
  );

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ErrorState
          title="We couldn't load your dossier"
          description="Check your connection and try again — nothing you have answered is lost."
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  const dossier: StudioDossier | null = normalizeStoredProfile(profile?.color_profile);

  /** The edit shell's exit: back to Studio, never forward to another step. */
  function done() {
    clearCandidate();
    router.back();
  }

  if (select) {
    return (
      <SingleSelect
        key={field}
        step={select.step}
        value={profile?.[select.field] ?? null}
        options={select.options}
        guidance={select.guidance}
        requiredMessage={select.requiredMessage}
        onBack={done}
        onSaved={done}
        save={(value) => autoSave.save({ [select.field]: value })}
        saveState={autoSave.state}
        onRetrySave={autoSave.retry}
        saving={autoSave.saving}
      />
    );
  }

  if (field === "location") {
    return (
      <Location
        value={profile?.default_location ?? null}
        onBack={done}
        onSaved={done}
        onSkip={done}
        save={(hubId) => autoSave.save({ default_location: hubId })}
        saveState={autoSave.state}
        onRetrySave={autoSave.retry}
        saving={autoSave.saving}
      />
    );
  }

  if (field === "beauty-preferences") {
    return (
      <BeautyPreferences
        value={normalizeBeautyPreferences(profile?.beauty_preferences)}
        onBack={done}
        onSaved={done}
        onSkip={done}
        save={(preferences: Json) => autoSave.save({ beauty_preferences: preferences })}
        saveState={autoSave.state}
        onRetrySave={autoSave.retry}
        saving={autoSave.saving}
      />
    );
  }

  // Retaking the colour analysis. The two steps are held here rather than in
  // the router: this is one edit, and a hardware back from the result should
  // return to the path, not out to Studio with a half-chosen season.
  if (colorStep === "path") {
    return (
      <ColorPath
        existingDossier={dossier}
        onBack={done}
        onCandidateReady={(next) => {
          setCandidate(next);
          setColorStep("result");
        }}
        onContinueExisting={done}
      />
    );
  }

  return (
    <ColorResult
      candidate={candidate}
      existingDossier={dossier}
      onBack={() => setColorStep("path")}
      onChooseAnother={() => {
        clearCandidate();
        setColorStep("path");
      }}
      onConfirmed={done}
      save={(payload) => autoSave.save(payload)}
      saveState={autoSave.state}
      onRetrySave={autoSave.retry}
      saving={autoSave.saving}
    />
  );
}
