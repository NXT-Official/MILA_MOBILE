import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { queryKeys } from "@/constants/query-keys";
import { conversationTitle, toHistory, type ChatRole } from "@/lib/concierge-history";
import { conciergeChat } from "@/services/api/concierge";
import { appendTurn, createConversation } from "@/services/supabase/concierge";
import { useAuthStore } from "@/stores/auth-store";

import { conciergeMessagesKey } from "./use-conversations";

export type SendInput = {
  message: string;
  /** The whole thread so far; trimmed to the server's budget in here. */
  thread: { role: ChatRole; content: string; failed?: boolean }[];
  conversationId: string | null;
  lookId: string | null;
};

export type SendResult = { conversationId: string; reply: string };

/**
 * One chat turn: ask, then persist both sides.
 *
 * The endpoint charges a credit and **writes nothing**. That split is the whole
 * design problem here — between a paid reply and a saved reply there is a
 * network call that can fail, and a member who paid for an answer must not lose
 * it to a dropped Supabase write.
 *
 * No retry from the query client (`mutations: { retry: false }`): a retried
 * credit-charging call is a double charge. The retry that *is* safe is handled
 * below, deliberately and only for the unpaid half.
 */
export function useSendMessage() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  /**
   * A reply that was paid for but not yet stored.
   *
   * Retrying the mutation with the same message resumes from the persist step
   * rather than asking Mila again — the answer is already bought, and charging
   * a second credit to fix a database hiccup would be indefensible. Keyed on
   * the message text, so a different question always asks properly.
   */
  const paid = useRef<{ message: string; reply: string; conversationId: string | null } | null>(
    null,
  );

  return useMutation<SendResult, unknown, SendInput>({
    mutationFn: async ({ message, thread, conversationId, lookId }) => {
      if (!userId) throw new Error("Not signed in.");

      const resumed = paid.current?.message === message ? paid.current : null;

      const reply =
        resumed?.reply ??
        (
          await conciergeChat({
            message,
            // Trimmed client-side to the server's own budget. The server trims
            // again, but making it do work the client can do means paying for
            // the difference on a cellular connection first.
            history: toHistory(thread),
            lookId,
          })
        ).reply;

      // From here the credit is spent. Everything below is recoverable.
      paid.current = { message, reply, conversationId: resumed?.conversationId ?? conversationId };

      let targetId = paid.current.conversationId;
      if (!targetId) {
        targetId = await createConversation(userId, conversationTitle(message));
        // Recorded before the messages land, so a failure between the two steps
        // resumes into the conversation that already exists rather than
        // creating a second empty one.
        paid.current = { ...paid.current, conversationId: targetId };
      }

      await appendTurn({ userId, conversationId: targetId, message, reply });

      paid.current = null;
      return { conversationId: targetId, reply };
    },

    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conciergeConversations(userId ?? undefined),
      });
      void queryClient.invalidateQueries({
        queryKey: conciergeMessagesKey(userId ?? undefined, result.conversationId),
      });
    },

    /**
     * On settle, not on success. The server charges before the provider call
     * and refunds on a throw, so the balance moved either way.
     */
    onSettled: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.credits(userId) });
    },
  });
}
