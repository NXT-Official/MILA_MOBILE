import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Why the primary action cannot run right now. Ordered by what she can act on
 * first — there is no point telling her to pick a city while she has no signal
 * to fetch its weather with.
 */
export type BlockedReason =
  | "offline"
  | "rate-limited"
  | "profile-incomplete"
  | "no-weather";

export function resolveBlockedReason(input: {
  online: boolean;
  profileComplete: boolean;
  hasWeather: boolean;
  /** Seconds left on a server rate limit, 0 when none is in force. */
  rateLimitedFor: number;
}): BlockedReason | null {
  if (!input.online) return "offline";
  // Ahead of the profile and weather checks: it is the only one with a clock on
  // it, and it is the only one she cannot resolve by doing something.
  if (input.rateLimitedFor > 0) return "rate-limited";
  if (!input.profileComplete) return "profile-incomplete";
  if (!input.hasWeather) return "no-weather";
  return null;
}

/**
 * Plain language, no error codes, and every one of these names something the
 * member can do next. `rate-limited` carries no entry: its copy is a live
 * countdown supplied by the caller.
 */
const BLOCKED_COPY: Record<Exclude<BlockedReason, "rate-limited">, string> = {
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
  blockedMessage,
  loading,
  onPress,
}: {
  blocked: BlockedReason | null;
  /** Required when `blocked` is `rate-limited` — the live countdown copy. */
  blockedMessage?: string;
  loading: boolean;
  onPress: () => void;
}) {
  const copy =
    blocked === null
      ? null
      : blocked === "rate-limited"
        ? (blockedMessage ?? "Mila needs a moment. Try again shortly.")
        : BLOCKED_COPY[blocked];

  return (
    <View className="gap-sm">
      <Button
        label={loading ? "Composing your look…" : "Compose today's look"}
        size="md"
        disabled={blocked !== null}
        loading={loading}
        onPress={onPress}
      />
      {copy ? (
        <View accessibilityLiveRegion="polite" className="flex-row items-start gap-sm">
          <View className="mt-xs">
            <Icon name={blocked === "offline" ? "offline" : "alert"} size="xs" color="muted" />
          </View>
          <Text className="flex-1 font-body text-sm text-body">{copy}</Text>
        </View>
      ) : null}
    </View>
  );
}
