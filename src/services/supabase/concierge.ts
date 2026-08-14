import type { ChatRole } from "@/lib/concierge-history";

import { supabase } from "./client";

/**
 * Conversation and message storage.
 *
 * Direct through RLS, per §7's direct-vs-API rule: no secret, no credit, and no
 * permission the database cannot express. The chat endpoint deliberately writes
 * nothing — it returns a reply and forgets it — so this file is the only thing
 * standing between a member and a conversation that vanishes on relaunch.
 *
 * Messages are immutable by grant: SELECT, INSERT and DELETE only, no UPDATE.
 */

export type ConversationRow = {
  id: string;
  title: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  role: ChatRole;
  content: string;
  image_url: string | null;
  created_at: string;
};

/** The 20 most recent, newest first — matching `(user_id, updated_at DESC)`. */
export async function fetchConversations(userId: string): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("concierge_conversations")
    .select("id,title,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

/**
 * `user_id` is in the predicate as well as the conversation id. RLS already
 * scopes this, but §7 is explicit that RLS is the floor and not the ceiling.
 *
 * Ordered by `created_at`, then role descending — a user message and its reply
 * can land on the same millisecond, and "user" sorts after "assistant"
 * alphabetically, so the secondary key is what keeps the question above the
 * answer rather than below it.
 */
export async function fetchMessages(
  userId: string,
  conversationId: string,
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("concierge_messages")
    .select("id,role,content,image_url,created_at")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("role", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function createConversation(userId: string, title: string): Promise<string> {
  const { data, error } = await supabase
    .from("concierge_conversations")
    .insert({ user_id: userId, title })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Both sides of one turn, in a single insert.
 *
 * One statement rather than two: a partial write would leave a question with no
 * answer in her history, and the credit has already been spent by the time this
 * runs.
 */
export async function appendTurn(input: {
  userId: string;
  conversationId: string;
  message: string;
  reply: string;
  imageUrl?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("concierge_messages").insert([
    {
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: "user",
      content: input.message,
      image_url: input.imageUrl ?? null,
    },
    {
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: "assistant",
      content: input.reply,
    },
  ]);

  if (error) throw error;

  // Bumps the conversation to the top of the list. Best-effort: the turn is
  // already saved, and a stale sort order is not worth failing a write she
  // has paid for.
  await supabase
    .from("concierge_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.conversationId)
    .eq("user_id", input.userId);
}

/** Messages cascade with the conversation. */
export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const { error } = await supabase
    .from("concierge_conversations")
    .delete()
    .eq("user_id", userId)
    .eq("id", conversationId);

  if (error) throw error;
}
