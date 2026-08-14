/**
 * The conversation history a chat turn carries.
 *
 * Pure, and separate from the screen, because the trimming rule is the one
 * piece of this feature that is easy to get quietly wrong: send too much and
 * the server trims it anyway (12 messages, 6000 characters) after the payload
 * has already crossed a cellular connection; send the *wrong* twelve and Mila
 * answers a question the member did not ask.
 */

export type ChatRole = "user" | "assistant";

export type ChatTurn = { role: ChatRole; content: string };

/** The server's cap, restated so the client does not make it do work it can do. */
export const MAX_HISTORY_MESSAGES = 12;

/** The server's character budget. Mirrored so a long thread is trimmed once, here. */
export const MAX_HISTORY_CHARACTERS = 6000;

/** The composer's cap, enforced at the keyboard rather than on submit. */
export const MAX_MESSAGE_LENGTH = 2000;

type SourceMessage = { role: ChatRole; content: string; failed?: boolean };

/**
 * The last `MAX_HISTORY_MESSAGES` turns, oldest first, within the character
 * budget.
 *
 * **Newest-first when trimming, oldest-first when sent.** Dropping from the
 * front is what keeps the most recent exchange — the part the next reply
 * actually depends on — when an early message is enormous.
 *
 * A failed send is excluded: it never reached Mila, so including it would ask
 * her to respond to something she has no reply to.
 */
export function toHistory(
  messages: SourceMessage[],
  maxMessages: number = MAX_HISTORY_MESSAGES,
  maxCharacters: number = MAX_HISTORY_CHARACTERS,
): ChatTurn[] {
  const usable = messages.filter((m) => !m.failed && m.content.trim().length > 0);

  const kept: ChatTurn[] = [];
  let characters = 0;

  for (let i = usable.length - 1; i >= 0 && kept.length < maxMessages; i -= 1) {
    const message = usable[i];
    // A single message over the whole budget would otherwise send nothing at
    // all; stopping here keeps whatever newer context already fits.
    if (characters + message.content.length > maxCharacters) break;
    characters += message.content.length;
    kept.push({ role: message.role, content: message.content });
  }

  return kept.reverse();
}

/**
 * A conversation's title, taken from its opening message.
 *
 * The column is capped at 120 characters, so this is a hard requirement rather
 * than a display nicety — an untrimmed title is a failed insert.
 */
export function conversationTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New conversation";
  return trimmed.length <= 120 ? trimmed : `${trimmed.slice(0, 119)}…`;
}
