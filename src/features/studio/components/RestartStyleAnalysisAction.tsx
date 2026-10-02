import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useOnboardingStore } from "@/stores/onboarding-store";

/**
 * The web's `RestartStyleAnalysisAction`: the one discoverable way back through
 * the whole guided wizard once a profile is complete. Non-destructive by
 * default — every step preloads her current answer, so nothing changes until
 * she saves.
 *
 * The navigation is NOT issued from here. Latching `active` re-renders the
 * root gate in the same commit, and the gate unmounts the tabs — this button
 * with them — before any effect of its own can run; the `router.push` this
 * component used to make was silently dropped, and the machine then resumed at
 * the last incomplete step instead of the first. The intent goes into the
 * onboarding store and the machine, which is mounted by then, starts the
 * wizard at `gender` — the first step of the style profile proper, and where
 * the web's restart lands too (its `/onboarding/style-profile`).
 */
export function RestartStyleAnalysisAction() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const enterOnboarding = useOnboardingStore((s) => s.enterOnboarding);
  const requestRestart = useOnboardingStore((s) => s.requestRestart);

  return (
    <>
      <Button
        label="Restart Style Analysis"
        variant="secondary"
        onPress={() => setConfirmOpen(true)}
      />
      <ConfirmSheet
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Restart your style analysis?"
        message="This walks you back through your full style profile, including gender and body type. Your current profile stays until you save changes."
        confirmLabel="Restart"
        onConfirm={() => {
          setConfirmOpen(false);
          enterOnboarding();
          requestRestart();
        }}
      />
    </>
  );
}
