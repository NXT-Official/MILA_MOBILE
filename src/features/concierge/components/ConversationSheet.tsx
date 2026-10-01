import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { ErrorState } from "@/components/ui/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { Sheet } from "@/components/ui/Sheet";
import { CONVERSATION_TITLE_MAX } from "@/lib/concierge-history";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/error-message";
import { relativeTime } from "@/utils/relative-time";

import { useConversations, useDeleteConversation, useRenameConversation } from "../hooks/use-conversations";

/**
 * Past conversations, as a **bottom sheet from the header** — never a side
 * drawer (§3). A drawer competes with the system back gesture on Android and
 * puts a navigation surface where the platform expects none.
 *
 * Rows rename in place, the same as the web's pencil: the title column belongs
 * to its owner, so the update goes straight through RLS.
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const { data: conversations, isPending, isError, refetch } = useConversations();
  const remove = useDeleteConversation();
  const rename = useRenameConversation();

  function startEditing(id: string, currentTitle: string) {
    setEditingId(id);
    setTitleDraft(currentTitle);
    setRenameError(null);
  }

  function saveTitle(id: string) {
    const title = titleDraft.trim();
    if (!title) {
      setRenameError("Title can't be empty.");
      return;
    }
    if (title.length > CONVERSATION_TITLE_MAX) {
      setRenameError(`Title must be ${CONVERSATION_TITLE_MAX} characters or fewer.`);
      return;
    }
    setRenameError(null);
    rename.mutate(
      { conversationId: id, title },
      {
        onSuccess: () => setEditingId(null),
        onError: (error) =>
          setRenameError(errorMessage(error, "Couldn't rename the conversation. Please try again.")),
      },
    );
  }

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

          {conversations?.map((conversation) =>
            editingId === conversation.id ? (
              <View key={conversation.id} className="gap-sm">
                <Input
                  label="Conversation name"
                  autoFocus
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  maxLength={CONVERSATION_TITLE_MAX}
                  returnKeyType="done"
                  onSubmitEditing={() => saveTitle(conversation.id)}
                  error={renameError ?? undefined}
                />
                <View className="flex-row gap-sm">
                  <Button
                    label="Save"
                    loading={rename.isPending}
                    onPress={() => saveTitle(conversation.id)}
                    className="flex-1"
                  />
                  <Button
                    label="Cancel"
                    variant="ghost"
                    disabled={rename.isPending}
                    onPress={() => setEditingId(null)}
                    className="flex-1"
                  />
                </View>
              </View>
            ) : (
              <View key={conversation.id} className="flex-row items-center gap-sm">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: conversation.id === currentId }}
                  accessibilityLabel={`${conversation.title}, ${relativeTime(conversation.updated_at)}`}
                  onPress={() => {
                    onSelect(conversation.id);
                    onClose();
                  }}
                  className={cn(
                    "active:opacity-80 min-h-tap flex-1 justify-center gap-xs rounded-panel border px-lg py-md",
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
                  accessibilityLabel={`Rename "${conversation.title}"`}
                  onPress={() => startEditing(conversation.id, conversation.title)}
                  className="active:opacity-60 h-tap w-tap items-center justify-center"
                >
                  <Icon name="edit" size="sm" color="muted" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete "${conversation.title}"`}
                  onPress={() => setConfirmDelete(conversation.id)}
                  className="active:opacity-60 h-tap w-tap items-center justify-center"
                >
                  <Icon name="trash" size="sm" color="muted" />
                </Pressable>
              </View>
            ),
          )}
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
