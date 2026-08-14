import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { ErrorState } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/utils/cn";
import { relativeTime } from "@/utils/relative-time";

import { useConversations, useDeleteConversation } from "../hooks/use-conversations";

/**
 * Past conversations, as a **bottom sheet from the header** — never a side
 * drawer (§3). A drawer competes with the system back gesture on Android and
 * puts a navigation surface where the platform expects none.
 */
export function ConversationSheet({
  visible,
  currentId,
  onClose,
  onSelect,
  onNewConversation,
}: {
  visible: boolean;
  currentId: string | null;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
  onNewConversation: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { data: conversations, isPending, isError, refetch } = useConversations();
  const remove = useDeleteConversation();

  return (
    <>
      <Sheet visible={visible && !confirmDelete} onClose={onClose} title="Your conversations">
        <View className="gap-md">
          <Button
            label="Start a new conversation"
            variant="secondary"
            onPress={() => {
              onNewConversation();
              onClose();
            }}
          />

          {isPending ? <LoadingState label="Loading your conversations" lines={3} /> : null}

          {isError ? (
            <ErrorState
              title="Your conversations didn't load"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => void refetch()}
            />
          ) : null}

          {conversations?.length === 0 ? (
            <Text className="font-body text-base text-body">
              Nothing here yet. Your threads with Mila are kept so you can pick one back up.
            </Text>
          ) : null}

          {conversations?.map((conversation) => (
            <View key={conversation.id} className="flex-row items-center gap-sm">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: conversation.id === currentId }}
                accessibilityLabel={`${conversation.title}, ${relativeTime(conversation.updated_at)}`}
                onPress={() => {
                  onSelect(conversation.id);
                  onClose();
                }}
                style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
                className={cn(
                  "min-h-tap flex-1 justify-center gap-xs rounded-panel border px-lg py-md",
                  conversation.id === currentId
                    ? "border-ink bg-accent-soft"
                    : "border-border bg-surface dark:border-border/12",
                )}
              >
                <Text numberOfLines={1} className="font-body-medium text-base text-ink">
                  {conversation.title}
                </Text>
                <Text className="font-body text-micro text-muted">
                  {relativeTime(conversation.updated_at)}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete "${conversation.title}"`}
                onPress={() => setConfirmDelete(conversation.id)}
                style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
                className="h-tap w-tap items-center justify-center"
              >
                <Icon name="trash" size="sm" color="muted" />
              </Pressable>
            </View>
          ))}
        </View>
      </Sheet>

      <ConfirmSheet
        visible={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this conversation?"
        message="Every message in it goes with it. The credits it used are not returned."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (!confirmDelete) return;
          remove.mutate(confirmDelete, {
            onSuccess: () => {
              // Deleting the thread she is reading has to empty the screen, or
              // the composer would send into a conversation that is gone.
              if (confirmDelete === currentId) onNewConversation();
              setConfirmDelete(null);
            },
          });
        }}
      />
    </>
  );
}
