# Phase 07 — Concierge AI Chat

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §3 Concierge detail, §6 concierge
> endpoint, §8 AI integration, §15 Phase 7.

## Goal

Build the AI stylist conversation: a chat thread that can be anchored to a specific look, with
history that survives a relaunch.

---

## User Outcome

A member can ask Mila about a look — why it works, what to change, what to wear instead — and get a
stylist's answer in the same calm voice as the rest of the product. Her conversations are there when
she comes back.

---

## Scope

- Chat thread with the composer pinned above the keyboard
- Conversation history, persisted by the client after each turn
- Conversation list as a bottom sheet from the header — not a side drawer
- Anchored look card above the first message
- Suggested actions on a reply
- The §6 error taxonomy for a chat turn, including credits and rate limits

---

## Not Included

- Streaming replies. The endpoint returns a complete reply
- Image attachments in chat. The contract supports `imageUrl`; the UI for it is not in this phase
- Push notifications for a reply
- Any prompt, system message, or model configuration — **all server-side**
- Server-side history writes. The endpoint returns a reply and does **not** persist it; the client
  owns that, exactly as the web does

---

## Implementation Tasks

Ordered. Each task is one commit.

1. **Write `services/api/concierge.ts`** — `conciergeChat` against `POST /api/v1/concierge/chat`,
   45 s timeout.
2. **Write the conversation persistence layer** — direct Supabase CRUD on
   `concierge_conversations` and `concierge_messages`. The client writes both the sent message and
   the returned reply after each turn.
3. **Build `stores/concierge-store.ts`** — the anchored look only. Small, UI-only, not persisted.
4. **Build the thread screen** — a list of messages, newest at the bottom, that restores scroll
   position on return.
5. **Build `MessageBubble`** — member and Mila variants. Mila's replies use body type, never the
   display serif.
6. **Build `Composer`** — pinned above the keyboard with `useSafeAreaInsets().bottom` padding. Verify
   on a device with gesture navigation **and** one with a button navigation bar.
7. **Build the send flow** — optimistic member message, loading state for the reply, and a recoverable
   failure that **keeps the typed text**.
8. **Cap history at 12 messages** client-side before sending. The server trims further (12 messages
   and 6000 characters), but do not make it do work the client can do.
9. **Build `ConversationSheet`** — the conversation list, opened from the header.
10. **Build `AnchoredLookCard`** — renders above the first message when a look is anchored, and
    clears correctly when the conversation moves on.
11. **Wire "Ask Mila" from Look detail** (Phase 04) to anchor a look and open the thread.
12. **Build suggested actions** on a reply — taps that prefill the composer, not hidden API calls.
13. **Map the error codes:** `INSUFFICIENT_CREDITS` → paywall without losing the message,
    `RATE_LIMITED` → countdown, `AI_UNAVAILABLE` → calm copy with retry.

---

## Screens

| #   | Screen            | Route               | Notes                                 |
| --- | ----------------- | ------------------- | ------------------------------------- |
| 9   | **Concierge**     | `/(tabs)/concierge` | Replaces the Phase 03 placeholder     |
| —   | Conversation list | Bottom sheet        | From the header — never a side drawer |
| 11  | Look detail       | `/look/[id]`        | Existing — gains an "Ask Mila" action |

---

## Components

`Thread` · `MessageBubble` · `Composer` · `ConversationSheet` · `AnchoredLookCard` ·
`SuggestedActions` · `TypingIndicator`

Reused: `Sheet`, `Button`, `Input`, `EmptyState`, `ErrorState`, `Icon`, `PaywallSheet`.

An empty Concierge needs a real empty state: icon, title, one line, one action — not a bare thread.

---

## Services / Integrations

| Endpoint               | Cost     | Rate limit | Timeout | Request                                              |
| ---------------------- | -------- | ---------- | ------- | ---------------------------------------------------- |
| `POST /concierge/chat` | 1 credit | 20 / 5 min | 45 s    | `{ message ≤2000, history ≤12, lookId?, imageUrl? }` |

Also used: `services/supabase/client` for direct conversation and message CRUD.

**The endpoint does not write history.** It returns `{ reply }`. The client persists both sides of
the turn. If the persist fails after a successful reply, the credit was still spent — retry the write
rather than discarding the reply.

---

## Database Requirements

| Table                     | Access               | How                                    |
| ------------------------- | -------------------- | -------------------------------------- |
| `concierge_conversations` | full CRUD, own rows  | Direct, RLS-scoped                     |
| `concierge_messages`      | insert, read, delete | Direct — the client persists each turn |
| `user_entitlements`       | **read only**        | Direct — balance display               |
| `outfits`                 | read own             | Direct — the anchored look             |

No schema change. No new table.

---

## State Requirements

| Owner                    | Holds                                           | Persisted |
| ------------------------ | ----------------------------------------------- | --------- |
| TanStack Query           | `conciergeConversations(userId)` — 30 s stale   | In-memory |
| TanStack Query           | Messages for the open conversation              | In-memory |
| TanStack Query           | `credits(userId)` — invalidated after each turn | In-memory |
| `stores/concierge-store` | The anchored look                               | No        |
| `useState`               | Composer draft text                             | —         |

Invalidate `conciergeConversations` after a new thread. Invalidate `credits` on settle after every
turn.

---

## Testing Checklist

- [ ] **Send message:** a message sends and appears immediately
- [ ] **Receive response:** the reply arrives and both sides persist
- [ ] Both survive a full app kill and relaunch
- [ ] History is capped at 12 messages client-side before sending
- [ ] **Loading state** keeps the composer usable and the thread readable
- [ ] **Error handling:** a failed send keeps the typed message recoverable — never discarded
- [ ] `INSUFFICIENT_CREDITS` opens the paywall mid-conversation without losing the message
- [ ] Rate limit (21 messages in 5 minutes) shows the countdown
- [ ] `AI_UNAVAILABLE` shows the calm copy with a retry
- [ ] Anchoring a look from Look detail renders the card and clears afterwards
- [ ] The conversation list opens as a bottom sheet and switches threads correctly
- [ ] **Keyboard never covers the composer** — verified on gesture and button navigation
- [ ] Message ≤2000 characters is enforced with a visible limit
- [ ] Empty Concierge renders a real empty state
- [ ] A persist failure after a successful reply retries rather than losing the reply
- [ ] Screen reader reads messages in order and announces a new reply

---

## Definition of Done

The user can interact with the Mila AI stylist:

- A member can hold a conversation, anchored to a look, with history intact across relaunches
- Every §6 error code reachable from a chat turn is mapped and was triggered on a device
- No prompt or model configuration exists in this repo
- Phase 00–06 gates still pass, and §17 of the architecture doc passes
