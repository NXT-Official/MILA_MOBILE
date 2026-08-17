import { useRef } from "react";
import { FlatList, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import type { ChatRole } from "@/lib/concierge-history";
import { spacing } from "@/theme/tokens";

import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

export type ThreadMessage = {
  id: string;
  role: ChatRole;
  content: string;
  failed?: boolean;
};

/**
 * The conversation, oldest at the top.
 *
 * `FlatList` with the natural order rather than `inverted`: an inverted list
 * reverses the accessibility reading order too, and the checklist requires a
 * screen reader to read messages in order. Scrolling to the end on new content
 * costs one call and keeps both behaviours correct.
 */
export function Thread({
  messages,
  awaitingReply,
  header,
  anchored,
}: {
  messages: ThreadMessage[];
  awaitingReply: boolean;
  /** The anchored look card, above the first message. */
  header: React.ReactNode;
  /** True when a saved look is anchored — the opening copy addresses it. */
  anchored: boolean;
}) {
  const list = useRef<FlatList<ThreadMessage>>(null);

  if (messages.length === 0 && !awaitingReply) {
    return (
      <View className="flex-1">
        {header}
        {/* The web's opening, verbatim. §10's empty state wants one action, and
            it has two directly below it that no button could improve on: the
            prompt pills and the composer itself. A "Start a conversation"
            button above a message box is a button that asks her to agree to do
            what she is already able to do. */}
        <View className="flex-1 items-center justify-center gap-md px-xl">
          <Icon name="sparkle" size="lg" color="accent" />
          <Text accessibilityRole="header" className="font-display text-h3 text-ink text-center">
            {anchored ? "We're studying this look." : "How can I help you style today?"}
          </Text>
          <Text className="font-body text-base text-body text-center">
            {anchored
              ? "Ask anything about this look — pairings, refinements, occasions, or palette fit."
              : "Ask about outfits, color, proportions, beauty, occasions, packing, or wardrobe planning."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      ref={list}
      data={messages}
      keyExtractor={(message) => message.id}
      ListHeaderComponent={<View className="pb-lg">{header}</View>}
      ListFooterComponent={awaitingReply ? <TypingIndicator /> : null}
      // Third-party props that take style objects — case 1 of the exceptions.
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // A new message should land in view without yanking the thread while she
      // is reading further up.
      onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
      renderItem={({ item }) => (
        <MessageBubble role={item.role} content={item.content} failed={item.failed} />
      )}
    />
  );
}
