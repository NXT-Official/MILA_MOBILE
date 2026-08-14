import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { queryKeys } from "@/constants/query-keys";
import type { PostItem } from "@/lib/outfit-items";
import { analyzeOutfitItems } from "@/services/api/items";
import { createPost } from "@/services/api/posts";
import type { CapturedPhoto } from "@/services/camera";
import { uploadPostImage } from "@/services/supabase/storage";
import { useAuthStore } from "@/stores/auth-store";

export type PublishResult = { postId: string; items: PostItem[] };

/**
 * Publish an OOTD: upload both halves, create the post, then detect garments.
 *
 * **Detection is best-effort and never rethrows.** The post is already
 * published by the time it runs; letting a failed vision call surface as a
 * publish error would tell a member her outfit did not post when it did. A
 * zero-detection result is equally silent — the server refunds the credit, and
 * a post with no hotspots is a perfectly good post.
 *
 * No retry (the client default): `/items/analyze` charges a credit.
 */
export function usePublishPost() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  /**
   * The timestamp is the path, so it has to survive a retry.
   *
   * Without this, a publish that uploaded the back frame and then failed on the
   * front would pick a fresh timestamp on the retry and re-upload the back frame
   * to a *new* path — leaving the first one orphaned in a private bucket with
   * nothing referencing it. Keyed on both URIs, so a retake gets a clean one.
   */
  const session = useRef<{ key: string; timestamp: number } | null>(null);

  return useMutation<PublishResult, unknown, { back: CapturedPhoto; front: CapturedPhoto; caption: string }>({
    mutationFn: async ({ back, front, caption }) => {
      if (!userId) throw new Error("Not signed in.");

      // One timestamp for both halves, so a post's two objects sort together.
      const key = `${back.uri}|${front.uri}`;
      if (session.current?.key !== key) session.current = { key, timestamp: Date.now() };
      const { timestamp } = session.current;
      // Sequential, not parallel: two concurrent multi-hundred-KB uploads on a
      // cellular connection contend for the same pipe and neither finishes
      // sooner, and a failure part-way is easier to reason about in order.
      const backPath = await uploadPostImage(userId, back.uri, "back", timestamp);
      const frontPath = await uploadPostImage(userId, front.uri, "front", timestamp);

      const post = await createPost({
        image_path_back: backPath,
        image_path_front: frontPath,
        caption: caption.trim() || null,
      });

      let items: PostItem[] = [];
      try {
        items = await analyzeOutfitItems(post.id);
      } catch {
        // Swallowed deliberately — see above. The post stands; it simply has no
        // hotspots, and the tagging sheet stays closed.
      }

      return { postId: post.id, items };
    },

    /**
     * On settle, not on success. Detection may have charged a credit even on a
     * path that threw, and a post that reached the database before a later step
     * failed still belongs in the feed.
     */
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed(userId ?? undefined) });
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.memberProfile(userId) });
      }
    },
  });
}
