# Phase 04 — AI Styling

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §6 endpoints and error codes, §7
> credit model, §8 AI integration, §15 Phase 4.

## Goal

Implement AI outfit generation end to end: compose a look, render its visual, save it, and account
for every credit correctly — including on failure.

**This is the phase that delivers the product.** Everything before it is scaffolding; everything
after it is expansion. Get here fast and put it on a real phone in someone's hand.

---

## User Outcome

A member taps "Compose today's look" and receives a styled outfit with hair and makeup guidance,
rendered as an image, which she can regenerate or save to her history. When something fails — and on
cellular it will — she keeps what succeeded and is told plainly what did not.

---

## Scope

- Generate look → `POST /look/generate` (1 credit)
- Look image → `POST /look/image` (free once, then 1 credit)
- Regenerate the outfit image, with the charge made explicit before the tap
- Save to history → `POST /look/save`
- Look detail with the three collapsible sections
- History list of saved looks
- Credit consumption and invalidation after every AI call
- The full §8 failure taxonomy, including **partial success**

---

## Not Included

- Camera-based analysis → Phase 05
- Sharing a look to the feed → Phase 06
- Anchoring a look into a conversation → Phase 07
- Buying credits. The paywall opens the read-only plan list; checkout is Phase 09
- Any change to prompts, refund predicates, or credit accounting. **All of that is server-side and
  shared with the web** — a prompt duplicated in this repo is a defect

---

## Non-negotiable rules for this phase

These are restated from `AGENTS.md` because this is the phase where they get broken.

1. **AI calls never happen from the device.** React Native → Mila backend → Gemini / Cloudflare. No
   provider key, no direct call, no exception.
2. **The client never computes a credit balance.** The server's `INSUFFICIENT_CREDITS` is the only
   authority.
3. **Do not reorder or merge `/look/generate` and `/look/image`.** `/generate` charges a credit and
   sets `look_image_pending`; `/image` claims that flag so the first visual is free. The billing
   depends on the sequence.
4. **Mutations never auto-retry.** A retried credit-charging call is a double charge.
5. **Partial success is a first-class state.** The look text is the product; the image is an
   enhancement. A failed image must never discard a successful composition.

---

## Implementation Tasks

Ordered. Each task is one commit.

1. **Copy `lib/credits.ts` and `lib/credits-countdown.ts` verbatim** — credit error identity and
   reset display.
2. **Write `services/api/look.ts`** — `generateDailyLook`, `regenerateOutfitImage`,
   `saveOutfitToHistory` against the §6 contract, with the per-endpoint timeouts: generate 60s,
   image **90s**, default 30s.
3. **Unit-test the error mapping** for all eight §6 codes before wiring any UI, especially
   `INSUFFICIENT_CREDITS` → paywall and `RATE_LIMITED` → countdown.
4. **Build `use-generate-look`** — mutation, no retry, invalidates `credits(userId)` on settle
   (success **and** failure — a failed call may still have charged and refunded).
5. **Replace the Phase 03 stub** on the generate CTA with the real call. The text look renders as
   soon as it lands.
6. **Build `use-look-image`** — fired after a successful generate, independently. The screen must not
   block on it.
7. **Handle partial success:** image failed, text succeeded → keep the look on screen, show the
   stated copy, offer a retry-image action.
8. **Build regenerate** — same endpoint, but state the charge before the tap. Do not surprise a
   member with a second credit.
9. **Build `use-save-look`** — `POST /look/save` with the look, image data URI, weather, and vibe.
   Disable save with the stated copy when a look has no visual.
10. **Build the History screen** — grid of saved looks, newest first.
11. **Build Look detail** (`/look/[id]`) — deep-linkable, with delete.
12. **Wire perceived-performance affordances:** skeletons mirroring the final layout,
    `expo-keep-awake` while a generation is in flight, `Haptics.notificationAsync(Success)` on
    completion, and an `AccessibilityInfo.announceForAccessibility` announcement.
13. **Handle mid-generation navigation.** A cancelled AI call **has already been charged** — warn
    before leaving, or let it finish and surface the result. Never silently discard a paid call.
14. **Verify every charge against `user_entitlements`** by hand before closing the phase.

---

## Screens

| #   | Screen      | Route        | Notes                                          |
| --- | ----------- | ------------ | ---------------------------------------------- |
| 5   | Home        | `/(tabs)/`   | Upgraded from Phase 03 — the CTA now generates |
| 10  | History     | `/history`   | Grid of saved looks, newest first              |
| 11  | Look detail | `/look/[id]` | Deep-linkable. Delete, and later Ask Concierge |

---

## Components

Reused from Phase 03: `OutfitVisual`, `LookDetail`, `GenerateButton`, `CreditsPill`, `PaywallSheet`,
`Skeleton`, `EmptyState`.

New: `LookCard` (history grid) · `RetryImageButton` · `ConfirmSheet` (regenerate charge) ·
`CreditCostHint`

No new primitive should be needed. If one is, add a variant rather than restyling.

---

## Services / Integrations

| Endpoint              | Cost                     | Timeout  | Notes                                          |
| --------------------- | ------------------------ | -------- | ---------------------------------------------- |
| `POST /look/generate` | **1 credit**             | 60 s     | Gemini, server-side. Sets `look_image_pending` |
| `POST /look/image`    | free once, then 1 credit | **90 s** | Cloudflare `flux-1-schnell`. Refunds on null   |
| `POST /look/save`     | free                     | 30 s     | Writes `outfits` + storage                     |

Provider calls, prompts, Zod schemas, rate limits, and refund predicates all live server-side. The
client sends typed input and receives typed output. Nothing else.

**Backend dependency:** all three routes live in staging before this phase starts.

---

## Database Requirements

| Table               | Access              | How                                                       |
| ------------------- | ------------------- | --------------------------------------------------------- |
| `outfits`           | full CRUD, own rows | Direct — list, delete                                     |
| `user_entitlements` | **read only**       | Direct — display and verification                         |
| `profiles`          | read own            | Direct — body type, season, undertone as generation input |

Storage: the `outfits` bucket, public, `${userId}/${uuid}.jpg`. The saved look's visual is written
server-side; the client uploads nothing in this phase.

The generated look is returned as a `data:` URI and uploaded to storage **only when the member
saves**.

---

## State Requirements

| Owner          | Holds                                                      | Notes                                 |
| -------------- | ---------------------------------------------------------- | ------------------------------------- |
| TanStack Query | `credits(userId)` — stale 0, refetched after every AI call | The only credit source                |
| TanStack Query | `outfits` / history list                                   | Invalidated after save and delete     |
| `useState`     | In-flight generation status, the current unsaved look      | Not a store — it dies with the screen |

**Mutations:** `retry: false` everywhere. Invalidate `credits` on settle, not only on success.

---

## Testing Checklist

- [ ] **Successful generation:** generate → text look appears → image fills in → save → in History
- [ ] The text look renders **before** the image arrives; the screen does not block on the slower call
- [ ] **Failed generation:** `AI_UNAVAILABLE` shows the calm copy with a retry
- [ ] **Partial success:** failed image with successful text keeps the look and offers retry-image
- [ ] **Retry** after a failure produces a look and charges exactly once
- [ ] **Credit limits:** `INSUFFICIENT_CREDITS` opens the paywall; the balance is unchanged
- [ ] Credit exhaustion mid-session updates the balance and blocks the next tap correctly
- [ ] `RATE_LIMITED` shows a countdown and disables the action until it elapses
- [ ] Timeout at 60 s (generate) and 90 s (image) produces the timeout state, not a hang
- [ ] Navigating away mid-generation does not lose the charge silently
- [ ] `expo-keep-awake` holds the screen; the success haptic fires
- [ ] Save is disabled with the stated copy when a look has no visual
- [ ] **Regenerating twice charges exactly twice** — verified against `user_entitlements`
- [ ] A null image refunds — verified against `user_entitlements`
- [ ] Offline disables generation with the standard copy
- [ ] No prompt text, provider name, or model id appears anywhere in the mobile bundle
- [ ] `npm run scan:secrets` still passes

---

## Definition of Done

The user can receive AI styling recommendations:

- Generate, regenerate, view, and save all work on a real device
- **Every failure path in §8 has been triggered deliberately**, not assumed
- Credit arithmetic matches `user_entitlements` in every case tested, including refunds
- Partial success keeps the composition on screen
- No AI call originates from the device and no prompt lives in this repo
- Phase 00–03 gates still pass, and §17 of the architecture doc passes
