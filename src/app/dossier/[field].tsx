import { useLocalSearchParams } from "expo-router";

import { DossierEditScreen } from "@/features/onboarding/DossierEditScreen";

/**
 * Editing one dossier answer from Studio. Deliberately outside the
 * `/onboarding` group, which `Stack.Protected` hides once a profile is
 * complete — see `DossierEditScreen`.
 */
export default function DossierEditRoute() {
  const { field } = useLocalSearchParams<{ field: string }>();
  return <DossierEditScreen field={field} />;
}
