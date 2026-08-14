import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/query-keys";
import {
  deleteConversation,
  fetchConversations,
  fetchMessages,
} from "@/services/supabase/concierge";
import { useAuthStore } from "@/stores/auth-store";

/** Declared here rather than in the copied `query-keys.ts`, so a re-copy from web lands clean. */
export const conciergeMessagesKey = (userId: string | undefined, conversationId: string | null) =>
  ["concierge-messages", userId, conversationId] as const;

/** The 20 most recent threads. 30s stale (§6). */
export function useConversations() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: queryKeys.conciergeConversations(userId ?? undefined),
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: () => fetchConversations(userId as string),
  });
}

/**
 * The persisted messages of the open thread.
 *
 * Disabled for a conversation that does not exist yet: the first turn creates
 * the row, and until then the thread is entirely the in-flight overlay the
 * screen holds.
 */
export function useConversationMessages(conversationId: string | null) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useQuery({
    queryKey: conciergeMessagesKey(userId ?? undefined, conversationId),
    enabled: Boolean(userId) && Boolean(conversationId),
    // The client is the only writer, so a refetch never finds anything the app
    // did not put there itself.
    staleTime: 5 * 60_000,
    queryFn: () => fetchMessages(userId as string, conversationId as string),
  });
}

export function useDeleteConversation() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  return useMutation<void, unknown, string>({
    mutationFn: (conversationId) => {
      if (!userId) throw new Error("Not signed in.");
      return deleteConversation(userId, conversationId);
    },
    // Explicit key, never a bare invalidateQueries().
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.conciergeConversations(userId ?? undefined),
      }),
  });
}
