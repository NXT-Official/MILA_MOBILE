import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { InlineError } from "@/components/ui/ErrorState";
import { Sheet } from "@/components/ui/Sheet";
import { resolveApiFailure } from "@/services/api/client";
import type { FeedPost } from "@/services/api/posts";

import { CaptionInput } from "./CaptionInput";
import { useDeletePost, useUpdateCaption } from "../hooks/use-feed";

/**
 * The long-press menu on your own post: edit the caption, or delete it.
 *
 * Reached by long press and by nothing else (§3). Inline controls on every card
 * would put a destructive action a mis-tap away from a scroll gesture, on a
 * surface built for one-thumb flicking.
 */
export function PostContextMenu({
  post,
  onClose,
}: {
  /** Null closes the menu. Always the member's own post. */
  post: FeedPost | null;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [caption, setCaption] = useState("");

  const update = useUpdateCaption();
  const remove = useDeletePost();

  function close() {
    setEditing(false);
    setConfirmDelete(false);
    update.reset();
    remove.reset();
    onClose();
  }

  return (
    <>
      <Sheet
        visible={Boolean(post) && !editing && !confirmDelete}
        onClose={close}
        title="Your post"
      >
        <View className="gap-md">
          <Button
            label="Edit caption"
            variant="secondary"
            onPress={() => {
              setCaption(post?.caption ?? "");
              setEditing(true);
            }}
          />
          <Button
            label="Delete post"
            variant="destructive"
            onPress={() => setConfirmDelete(true)}
          />
        </View>
      </Sheet>

      <Sheet visible={editing} onClose={close} title="Edit caption">
        <View className="gap-lg">
          <CaptionInput value={caption} onChangeText={setCaption} />

          {update.isError ? (
            <InlineError message={resolveApiFailure(update.error).message} />
          ) : null}

          <Button
            label="Save caption"
            loading={update.isPending}
            onPress={() => {
              if (!post) return;
              update.mutate({ postId: post.id, caption }, { onSuccess: close });
            }}
          />
          <Button label="Cancel" variant="ghost" disabled={update.isPending} onPress={close} />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={confirmDelete}
        onClose={close}
        title="Delete this post?"
        message="It leaves the feed for good, and both photographs are removed from storage. Any credit spent detecting its pieces is not returned."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (!post) return;
          remove.mutate(post.id, { onSuccess: close });
        }}
      />
    </>
  );
}
