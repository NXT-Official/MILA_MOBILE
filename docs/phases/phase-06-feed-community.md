# Phase 06 — Feed Community

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §3 Feed detail, §5 storage and signed
> URLs, §6 posts and items endpoints, §15 Phase 6.

## Goal

Create the community surface: browse other members' outfits, publish your own with a dual capture,
and explore the garments in a look.

---

## User Outcome

A member can scroll a feed of real outfits, tap a garment on someone's photo to see what it is and
find similar pieces, and publish her own outfit of the day as a paired full-body and portrait shot
with a caption.

---

## Scope

- Vertically paged feed, one post per viewport, pull-to-refresh
- Dual capture: rear "mirror selfie, full body" → front portrait → review + caption → publish
- Garment hotspots on the back image; tap opens an attributes sheet
- "Find similar" — **free, no AI call**
- Garment tagging sheet, opened automatically when garments are detected
- Own-post long-press menu: edit caption / delete
- Member profile screen (own and others)
- Signed-URL handling for the private `posts` bucket

---

## Not Included

- Likes, comments, follows, or any social graph. Not in the architecture, not in this phase
- Notifications about feed activity
- Feed pagination beyond what the endpoint returns today — see the note below
- Moderation tooling of any kind. **Mobile is a member application only**
- Dupe search from a captured image (`/dupes/find`, 1 credit). Only the free
  attribute-based `/dupes/similar` ships here

---

## Implementation Tasks

Ordered. Each task is one commit.

1. **Copy `lib/outfit-items.ts` verbatim** — item parsing and https URL normalisation.
2. **Write `services/api/posts.ts`** — `getFeed`, `createPost`, `updatePostCaption`, `deletePost`,
   `getMemberProfile`.
3. **Write `services/api/items.ts`** — `analyzeOutfitItems`, `updatePostItems`, `findSimilarItems`.
4. **Build `components/media/RemoteImage.tsx`** — and handle the expiring signed URL first, before
   any feed UI exists. A 403 refetches the parent query rather than showing a broken image.
5. **Build the feed list** with `FlashList`, one post per viewport, `recyclingKey` set, and a capped
   memory cache. This is the screen that OOMs a cheap phone if it is built carelessly.
6. **Build `FeedCard`** — dual images, author with verified badge, caption, relative time.
7. **Build the empty state.** A feed with no posts must read as an invitation, not a blank scroll.
8. **Build pull-to-refresh** and wire it to the `feed(userId)` query.
9. **Build `stores/capture-store.ts`** — the dual-capture session: back URI, front URI, caption,
   step. This one **is** a store, because the session survives navigation between capture steps.
10. **Build `DualCapture`** using the Phase 05 camera adapter — step 1 rear camera with the
    "Mirror selfie, full body" prompt, step 2 front camera portrait.
11. **Build the review + caption step** — caption ≤500 characters, with a live counter.
12. **Build publish** — upload both images to `posts/${userId}/back-${ts}.jpg` and
    `front-${ts}.jpg`, then `POST /posts/create` with the paths.
13. **Build the tagging sheet** — opens automatically when garments are detected, silent when none
    are (no credit is charged for a zero-detection result).
14. **Build garment hotspots** on the back image, and the attributes sheet behind them.
15. **Build "Find similar"** → `/dupes/similar`. Free. Do not gate it behind the paywall.
16. **Build the own-post context menu** — long-press for edit caption / delete. No inline controls.
17. **Build the member profile screen.** `can_view_hidden` is computed server-side and is true only
    for one's own profile.
18. **Test on a low-end device before closing the phase**, not after.

---

## Screens

| #   | Screen         | Route               | Notes                                           |
| --- | -------------- | ------------------- | ----------------------------------------------- |
| 6   | **Feed**       | `/(tabs)/feed`      | Replaces the Phase 03 placeholder               |
| 13  | Member profile | `/profile/[userId]` | Own profile shows a "Hidden" tab; others do not |
| —   | Dual capture   | full-screen modal   | Two-step capture, then review                   |

---

## Components

`FeedCard` · `DualCapture` · `CaptureStepPrompt` · `PublishSheet` · `CaptionInput` ·
`GarmentHotspot` · `GarmentDetailSheet` · `TaggingSheet` · `SimilarItemsSheet` · `VerifiedBadge` ·
`PostContextMenu`

**Media primitives:** `RemoteImage` · `ImageWithFallback` · `AvatarInitial`

---

## Services / Integrations

| Endpoint              | Cost                                    | Rate limit | Notes                                           |
| --------------------- | --------------------------------------- | ---------- | ----------------------------------------------- |
| `GET /posts/feed`     | free                                    | —          | ≤80 posts, 1-hour signed URLs                   |
| `POST /posts/create`  | free                                    | —          | Takes storage **paths**, not URLs               |
| `POST /posts/caption` | free                                    | —          | Edit own caption                                |
| `POST /posts/delete`  | free                                    | —          | Own posts only, re-checked server-side          |
| `GET /profile/member` | free                                    | —          | `?user_id=` → profile, posts, `can_view_hidden` |
| `POST /items/analyze` | 1 credit, **refunded if nothing found** | 10/hour    | Garment detection                               |
| `POST /items/update`  | free                                    | —          | Deletes any item absent from the array          |
| `POST /dupes/similar` | **free**                                | —          | Attribute-based, no AI call                     |

Also used: `services/camera/` (Phase 05 adapter), `services/supabase/storage.ts`, `utils/image.ts`.

**Signed URLs expire in one hour.** Treat them as expiring: a 403 refetches the parent query. Private
`posts` images are never addressed by path from the client.

**A non-https `source_url` is rejected with an error**, not silently dropped — surface it inline so a
typo does not look like it saved.

---

## Database Requirements

| Table                 | Access  | How                                       |
| --------------------- | ------- | ----------------------------------------- |
| `posts`               | via API | Server signs URLs and re-checks ownership |
| `post_items`          | via API | Server-scoped to the post's owner         |
| `products` / `brands` | read    | via API — similar-item results            |
| `profiles`            | read    | via API for other members; direct for own |

**Storage:** `posts` bucket, **private**, 10 MB limit, paths `${userId}/back-${timestamp}.jpg` and
`${userId}/front-${timestamp}.jpg`. The `${userId}/` prefix is enforced by storage RLS **and**
re-checked in `createPost` — storage RLS governs uploads, not what a database row may reference.

> **Feed payload size.** The endpoint returns up to 80 posts with up to 160 signed URLs in one
> request. That is defensible on desktop and wasteful on cellular. Appendix D.5 proposes a paginated
> endpoint (`?cursor=&limit=20`). If it is decided before this phase, build against the paginated
> shape; if not, ship against the current contract and measure the payload on a real connection.

---

## State Requirements

| Owner                  | Holds                                                    | Persisted |
| ---------------------- | -------------------------------------------------------- | --------- |
| TanStack Query         | `feed(userId)` — 30 s stale, refetch on pull and publish | In-memory |
| TanStack Query         | Member profile query                                     | In-memory |
| `stores/capture-store` | Dual-capture session: back URI, front URI, caption, step | No        |
| `useState`             | Sheet visibility, hotspot selection                      | —         |

Invalidate `feed(userId)` after publish and delete. Never a bare `invalidateQueries()`.

---

## Testing Checklist

- [ ] **Feed loading:** posts render with both images, author, caption, and relative time
- [ ] **Empty feed** renders the empty state, not a blank scroll area
- [ ] **Upload:** a post with both images and a caption publishes and appears in the feed
- [ ] **Refresh:** pull-to-refresh updates the feed
- [ ] Caption enforces the 500-character limit with a visible counter
- [ ] Tagging sheet opens automatically when garments are detected
- [ ] Zero garments detected is **silent** and charges no credit
- [ ] Delete removes the post from the feed and from storage
- [ ] Edit caption updates in place
- [ ] A signed URL expiring mid-session refetches instead of showing a broken image
- [ ] A non-https `source_url` is rejected inline
- [ ] "Find similar" returns results and charges nothing
- [ ] Own profile shows the "Hidden" tab; another member's profile does not
- [ ] Cancelling dual capture midway discards cleanly and leaves no orphaned upload
- [ ] **Scrolling 80 posts on a low-end device stays smooth and does not OOM**
- [ ] Feed payload size measured on a metered connection and recorded
- [ ] Android hardware back closes the sheet before the navigator

---

## Definition of Done

Users can participate in community features:

- A member can browse, publish, tag, delete, and explore garments on a real device
- The feed survives a low-end device and an expired signed URL
- No moderation, reporting, or staff surface exists in the codebase
- Phase 00–05 gates still pass, and §17 of the architecture doc passes
