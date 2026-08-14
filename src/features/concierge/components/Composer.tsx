import { Pressable, Text, TextInput, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { MAX_MESSAGE_LENGTH } from "@/lib/concierge-history";
import { useThemeColor } from "@/theme/tailwind";
import { cn } from "@/utils/cn";

/**
 * The message box and send control.
 *
 * Stays usable while a reply is in flight (§7 of the checklist): she can type
 * the next thought while Mila composes. Only *sending* is blocked, and the
 * button says why through its busy state rather than vanishing.
 *
 * `maxLength` enforces the 2000-character cap at the keyboard, so the limit is
 * felt as a stop rather than as a rejected message that cost a round trip.
 */
export function Composer({
  value,
  onChangeText,
  onSend,
  sending,
  blockedMessage,
}: {
  value: string;
  onChangeText: (next: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Offline or rate-limited: sending is disabled and the reason is shown. */
  blockedMessage: string | null;
}) {
  const placeholderColor = useThemeColor("muted");
  const remaining = MAX_MESSAGE_LENGTH - value.length;
  const nearLimit = remaining <= 100;
  const canSend = value.trim().length > 0 && !sending && !blockedMessage;

  return (
    <View className="gap-sm border-t border-border bg-canvas px-xl pt-md dark:border-border/12">
      {blockedMessage ? (
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-body">
          {blockedMessage}
        </Text>
      ) : null}

      <View className="flex-row items-end gap-sm">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          textAlignVertical="top"
          placeholder="Ask Mila about a look, an occasion, or a piece you own."
          placeholderTextColor={placeholderColor}
          accessibilityLabel="Message"
          // Grows with the text, then scrolls. A fixed single line makes a
          // considered question feel like a search box.
          className="max-h-3xl min-h-tap flex-1 rounded-control border border-border bg-surface px-lg py-md font-body text-base text-ink dark:border-border/12"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          disabled={!canSend}
          onPress={onSend}
          style={({ pressed }) => (pressed && canSend ? { opacity: 0.9 } : undefined)}
          className={cn(
            "h-tap w-tap items-center justify-center rounded-pill bg-ink",
            !canSend && "opacity-50",
          )}
        >
          <Icon name="send" size="sm" color="onInk" />
        </Pressable>
      </View>

      {nearLimit ? (
        <Text accessibilityLiveRegion="polite" className="self-end font-body text-micro text-ink">
          {value.length} / {MAX_MESSAGE_LENGTH}
        </Text>
      ) : null}
    </View>
  );
}
