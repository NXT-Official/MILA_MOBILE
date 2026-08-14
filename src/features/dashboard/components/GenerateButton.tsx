import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Why the primary action cannot run right now. Ordered by what she can act on
 * first — there is no point telling her to pick a city while she has no signal
 * to fetch its weather with.
 */
export type BlockedReason = "offline" | "profile-incomplete" | "no-weather";

export function resolveBlockedReason(input: {
  online: boolean;
  profileComplete: boolean;
  hasWeather: boolean;
}): BlockedReason | null {
  if (!input.online) return "offline";
  if (!input.profileComplete) return "profile-incomplete";
  if (!input.hasWeather) return "no-weather";
  return null;
}

/**
 * Plain language, no error codes, and every one of these names something the
 * member can do next.
 */
const BLOCKED_COPY: Record<BlockedReason, string> = {
  offline: "Mila needs a connection to compose your look.",
  "profile-incomplete": "Complete your Style Profile first.",
  "no-weather": "Still finding today's weather. Choose a city in the weather panel to continue.",
};

/**
 * The primary CTA. Blocked means **disabled with the reason on screen** — never
 * hidden. A control that disappears teaches a member the app is broken; a
 * disabled one with a line of copy teaches her what to fix.
 */
export function GenerateButton({
  blocked,
  loading,
  onPress,
}: {
  blocked: BlockedReason | null;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <View className="gap-sm">
      <Button
        label={loading ? "Composing your look…" : "Compose today's look"}
        size="md"
        disabled={blocked !== null}
        loading={loading}
        onPress={onPress}
      />
      {blocked ? (
        <View accessibilityLiveRegion="polite" className="flex-row items-start gap-sm">
          <View className="mt-xs">
            <Icon name={blocked === "offline" ? "offline" : "alert"} size="xs" color="muted" />
          </View>
          <Text className="flex-1 font-body text-sm text-body">{BLOCKED_COPY[blocked]}</Text>
        </View>
      ) : null}
    </View>
  );
}
