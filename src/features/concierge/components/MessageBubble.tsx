import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import type { ChatRole } from "@/lib/concierge-history";
import { radii } from "@/theme/tokens";
import { cn } from "@/utils/cn";

/**
 * One message.
 *
 * **Mila's replies are body type, never the display serif.** Playfair is for
 * headings, outfit names, and pulled quotes (§10) — a paragraph of styling
 * advice set in it reads as a magazine pull-quote rather than an answer, and at
 * this length it is genuinely harder to read.
 *
 * The two roles are separated by alignment, ground, and a name — not by hue
 * alone. A member who cannot tell the two washes apart still has the side of
 * the screen and the label.
 */
export function MessageBubble({
  role,
  content,
  imageUrl,
  failed = false,
  onRetry,
}: {
  role: ChatRole;
  content: string;
  /** A photo she attached, already in Mila storage. */
  imageUrl?: string | null;
  /** The send never reached Mila. Marked, kept, and retryable. */
  failed?: boolean;
  /** Re-sends this message in place — the web's "Try again". */
  onRetry?: () => void;
}) {
  const mine = role === "user";

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${mine ? "You" : "Mila"} said: ${content}${imageUrl ? ". With an attached photo." : ""}${failed ? ". Not sent." : ""}`}
      className={cn("w-full gap-xs", mine ? "items-end" : "items-start")}
    >
      <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
        {mine ? "You" : "Mila"}
      </Text>

      <View
        className={cn(
          "max-w-[85%] rounded-card px-lg py-md",
          mine
            ? "bg-surface-alt"
            : "border border-border bg-surface dark:border-border/12",
          failed && "opacity-60",
        )}
      >
        {imageUrl ? (
          <View className="mb-md">
            <Image
              source={{ uri: imageUrl }}
              // Case 1 of the StyleSheet exceptions: expo-image takes a style
              // object, and the radius comes from the token scale.
              style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radii.panel }}
              contentFit="cover"
              transition={200}
              accessibilityLabel="The photo you attached"
            />
          </View>
        ) : null}
        <Text className="font-body text-base text-ink">{content}</Text>
      </View>

      {failed ? (
        <View className="flex-row items-center gap-sm">
          <Icon name="alert" size="xs" color="muted" />
          <Text className="font-body text-micro text-muted">Not sent</Text>
          {onRetry ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try sending this message again"
              onPress={onRetry}
              hitSlop={8}
              className="active:opacity-60 min-h-tap justify-center"
            >
              <Text className="font-body-semibold text-micro tracking-label uppercase text-ink underline">
                Try again
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
