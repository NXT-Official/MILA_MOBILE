import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import { getFeed } from "@/services/api/posts";
import { deletePost, updatePostCaption } from "@/services/supabase/posts";
import { useAuthStore } from "@/stores/auth-store";

/**
 * The community feed. 30s stale (§6) — new posts appear on pull-to-refresh and
 * after publishing, not on a timer.
 *
 * The signed URLs inside the payload expire in an hour, which is well past
 * `staleTime`; `RemoteImage` calls `refetch` when one of them stops working, so
 * expiry is handled by the thing that notices it rather than by a background
 * clock nobody can see.
 */
export function useFeed() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: queryKeys.feed(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: getFeed,
  });
}

/** Explicit key, never a bare `invalidateQueries()`. */
function useFeedInvalidation() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.feed(userId ?? undefined) });
    if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.memberProfile(userId) });
  };
}

/** Direct through RLS — see `services/supabase/posts`, not an API call. */
export function useUpdateCaption() {
  const invalidate = useFeedInvalidation();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation<{ id: string }, unknown, { postId: string; caption: string }>({
    mutationFn: ({ postId, caption }) => {
      if (!userId) throw new Error("Not signed in.");
      // An emptied caption is `null`, not `""` — the column is nullable and the
      // feed card branches on absence, so a blank string would render an empty
      // paragraph rather than no paragraph.
      return updatePostCaption(userId, { post_id: postId, caption: caption.trim() || null });
    },
    onSuccess: invalidate,
  });
}

/** Direct through RLS — see `services/supabase/posts`, not an API call. */
export function useDeletePost() {
  const invalidate = useFeedInvalidation();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation<{ id: string }, unknown, string>({
    mutationFn: (postId) => {
      if (!userId) throw new Error("Not signed in.");
      return deletePost(userId, postId);
    },
    onSuccess: invalidate,
  });
}
