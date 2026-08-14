import { Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import type { ChatRole } from "@/lib/concierge-history";
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
  failed = false,
}: {
  role: ChatRole;
  content: string;
  /** The send never reached Mila. Marked, kept, and retryable. */
  failed?: boolean;
}) {
  const mine = role === "user";

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${mine ? "You" : "Mila"} said: ${content}${failed ? ". Not sent." : ""}`}
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
        <Text className="font-body text-base text-ink">{content}</Text>
      </View>

      {failed ? (
        <View className="flex-row items-center gap-xs">
          <Icon name="alert" size="xs" color="muted" />
          <Text className="font-body text-micro text-muted">Not sent</Text>
        </View>
      ) : null}
    </View>
  );
}
