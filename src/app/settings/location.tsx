import { DossierEditScreen } from "@/features/onboarding/DossierEditScreen";

/**
 * The default weather hub. Renders the Phase 02 location step in its edit
 * shell rather than a second picker — including the rule that a device fix is
 * confirmed before it is written.
 */
export default function DefaultLocation() {
  return <DossierEditScreen field="location" />;
}
