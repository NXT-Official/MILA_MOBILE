import { router } from "expo-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useOnboardingStore } from "@/stores/onboarding-store";

/**
 * The web's `RestartStyleAnalysisAction`: the one discoverable way back through
 * the whole guided wizard once a profile is complete. Non-destructive by
 * default — every step preloads her current answer, so nothing changes until
 * she saves.
 *
 * The push is deferred by one commit on purpose. The onboarding group is hidden
 * while a profile is complete (`Stack.Protected` in `app/_layout.tsx`), so the
 * latch has to be set first and the navigation made after the gate re-renders —
 * pushing in the same tick is dropped as a protected route.
 */
export function RestartStyleAnalysisAction() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const enterOnboarding = useOnboardingStore((s) => s.enterOnboarding);

  useEffect(() => {
    if (!restarting) return;
    // `gender` is the first step of the style profile proper — where the web's
    // restart lands too (its `/onboarding/style-profile`). Requesting it on a
    // complete profile is reachable, so the machine does not redirect.
    router.push("/onboarding/gender");
  }, [restarting]);

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
          setRestarting(true);
        }}
      />
    </>
  );
}
