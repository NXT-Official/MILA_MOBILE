import { useLocalSearchParams } from "expo-router";

import { SupportScreen } from "@/features/settings/SupportScreen";

/**
 * `?kind=feedback` preselects the feedback chip — the auth card's "Send
 * Feedback" link opens the screen that way, exactly as the web's support dialog
 * opens on its feedback tab.
 */
export default function Support() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();

  return <SupportScreen initialKind={kind === "feedback" ? "feedback" : "help"} />;
}
