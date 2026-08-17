import { Image } from "expo-image";
import { Pressable, Text, TextInput, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import type { Dictation } from "@/hooks/use-dictation";
import { MAX_MESSAGE_LENGTH } from "@/lib/concierge-history";
import { useThemeColor } from "@/theme/tailwind";
import { radii } from "@/theme/tokens";
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
  attachmentUri,
  onAttach,
  onClearAttachment,
  attachError,
  dictation,
}: {
  value: string;
  onChangeText: (next: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Offline or rate-limited: sending is disabled and the reason is shown. */
  blockedMessage: string | null;
  /** The local file waiting to go with the next message, or null. */
  attachmentUri: string | null;
  onAttach: () => void;
  onClearAttachment: () => void;
  /** The picker failed. Plain language, no code (§10). */
  attachError: string | null;
  dictation: Dictation;
}) {
  const placeholderColor = useThemeColor("muted");
  const remaining = MAX_MESSAGE_LENGTH - value.length;
  const nearLimit = remaining <= 100;
  // Text is still required with a photo, as on the web: an image with no
  // question spends a credit on Mila guessing what was being asked.
  const canSend = value.trim().length > 0 && !sending && !blockedMessage;

  return (
    <View className="gap-sm border-t border-border bg-canvas px-lg pt-md dark:border-border/12">
      {blockedMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-body text-sm text-body"
        >
          {blockedMessage}
        </Text>
      ) : null}

      {attachmentUri ? (
        <View className="flex-row items-center gap-md self-start rounded-panel border border-border bg-surface p-sm dark:border-border/12">
          <Image
            source={{ uri: attachmentUri }}
            // Case 1 of the StyleSheet exceptions: expo-image takes a style
            // object, and the radius comes from the token scale.
            style={{ width: 40, height: 40, borderRadius: radii.control }}
            contentFit="cover"
            accessibilityLabel="The photo you attached"
          />
          <Text className="font-body text-sm text-body">Photo attached</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove the attached photo"
            onPress={onClearAttachment}
            className="active:opacity-60 h-tap w-tap items-center justify-center"
          >
            <Icon name="close" size="sm" color="muted" />
          </Pressable>
        </View>
      ) : null}

      {(attachError ?? dictation.error) ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-body text-sm text-body"
        >
          {attachError ?? dictation.error}
        </Text>
      ) : null}

      {dictation.listening ? (
        // A dot and a sentence, not a colour: §11 forbids a state carried by
        // hue alone, and "the mic is live" is the one state in the app where
        // getting that wrong means she is being listened to and cannot tell.
        <View
          accessibilityLiveRegion="polite"
          className="flex-row items-center gap-sm"
        >
          <View className="h-xs w-xs rounded-pill bg-accent" />
          <Text className="font-body-semibold text-label tracking-label uppercase text-body">
            Listening — tap the mic to stop
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center gap-sm">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Ask Mila about a look, an occasion, or a piece you own."
          placeholderTextColor={placeholderColor}
          accessibilityLabel="Message"
          // Deliberately single-line, as the web's is. It scrolls horizontally
          // rather than growing: with three controls beside it, a box that grew
          // to four lines pushed the send button off a short screen while she
          // was still typing.
          submitBehavior="submit"
          returnKeyType="send"
          onSubmitEditing={() => canSend && onSend()}
          className="h-tap flex-1 rounded-pill border border-border bg-surface px-lg font-body text-base text-ink dark:border-border/12"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            attachmentUri ? "Replace the attached photo" : "Attach a photo"
          }
          accessibilityHint="Opens your photo library. Nothing is sent until you send the message."
          disabled={sending}
          onPress={onAttach}
          className={cn(
            "h-tap w-tap items-center justify-center rounded-pill border border-border bg-surface dark:border-border/12",
            sending ? "opacity-50" : "active:opacity-80",
          )}
        >
          <Icon name="attach" size="sm" color="body" />
        </Pressable>

        {/* Absent, not disabled, on a device with no recogniser: a mic that can
            never work is worse than no mic. */}
        {dictation.supported ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: dictation.listening }}
            accessibilityLabel={
              dictation.listening ? "Stop dictation" : "Dictate your message"
            }
            disabled={sending}
            onPress={dictation.toggle}
            className={cn(
              "h-tap w-tap items-center justify-center rounded-pill border",
              dictation.listening
                ? "border-ink bg-accent-soft"
                : "border-border bg-surface dark:border-border/12",
              sending ? "opacity-50" : "active:opacity-80",
            )}
          >
            <Icon
              name="mic"
              size="sm"
              color={dictation.listening ? "ink" : "body"}
            />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          disabled={!canSend}
          onPress={onSend}
          style={({ pressed }) =>
            pressed && canSend ? { opacity: 0.9 } : undefined
          }
          className={cn(
            "h-tap w-tap items-center justify-center rounded-pill bg-ink",
            !canSend && "opacity-50",
          )}
        >
          <Icon name="send" size="sm" color="onInk" />
        </Pressable>
      </View>

      {nearLimit ? (
        <Text
          accessibilityLiveRegion="polite"
          className="self-end font-body text-micro text-ink"
        >
          {value.length} / {MAX_MESSAGE_LENGTH}
        </Text>
      ) : null}
    </View>
  );
}
