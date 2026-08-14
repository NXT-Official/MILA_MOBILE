import { useRef } from "react";
import { FlatList, View } from "react-native";

import { EmptyState } from "@/components/ui/EmptyState";
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
  emptyAction,
}: {
  messages: ThreadMessage[];
  awaitingReply: boolean;
  /** The anchored look card, above the first message. */
  header: React.ReactNode;
  emptyAction?: { label: string; onPress: () => void };
}) {
  const list = useRef<FlatList<ThreadMessage>>(null);

  if (messages.length === 0 && !awaitingReply) {
    return (
      <View className="flex-1">
        {header}
        <View className="flex-1 justify-center">
          {/* A real empty state, not a bare thread: icon, title, one line, one
              action (§10). */}
          <EmptyState
            icon="concierge"
            title="Ask Mila anything"
            description="She knows your season, your silhouette, and what you have saved."
            actionLabel={emptyAction?.label}
            onAction={emptyAction?.onPress}
          />
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
