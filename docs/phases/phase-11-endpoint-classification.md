# Phase 11 — Endpoint classification

> Phase 1 of the mobile↔web sync plan. Supersedes the "22 routes to build" assumption in
> [`phase-10-endpoint-status.md`](./phase-10-endpoint-status.md) and Appendix B.
>
> Sources inspected: `MILA/app/supabase/migrations/*.sql` (47 RLS policies), every
> `MILA/app/src/lib/*.functions.ts`, `MILA/app/src/routes/api/`, and every
> `MILA_MOBILE/src/services/api/*.ts`.

## Headline

**22 endpoints were assumed. Only 14 need `/api/v1`. Five are ordinary user-owned CRUD that RLS
already enforces**, and can move to direct Supabase with no backend work at all.

The website currently exposes exactly **one** HTTP route — `src/routes/api/webhooks/paddle.ts`.
Everything else is a TanStack Start server function, which is internal RPC and not callable from a
phone. That is the whole reason `EXPO_PUBLIC_API_BASE_URL` is a placeholder.

## The rule applied

```text
DIRECT SUPABASE   =  user-owned data AND RLS alone can enforce authorization
/api/v1           =  a secret, a credit, a privileged read, or trusted business logic
```

A web implementation using `supabaseAdmin` was **not** treated as proof that an operation needs the
server. Each one was traced to find *why* it escalates. Two escalate for a read that RLS could be
taught to allow; the rest escalate because RLS genuinely cannot express the check.

## Classification

### A. Direct Supabase — no API route needed (5)

| Endpoint | Web implementation | Why it is safe direct | RLS relied on |
| --- | --- | --- | --- |
| `look/save` | `save-outfit.functions.ts` | No secret, no credit, no admin — the only such AI-adjacent function | `Users insert own outfits` |
| `items/update` | `outfit-items.functions.ts` → `updatePostItems` | Uses the **user-scoped** client already; touches `post_items` + an ownership check on `posts` | `Post owners manage their post items` |
| ~~`posts/create`~~ | — | **Reclassified in Phase 5 — see below. It stays on `/api/v1`.** | — |
| `posts/delete` | `posts.functions.ts` → `deletePost` | User-scoped client + storage remove from `posts` bucket | `Users can manage their own posts`, `Users can delete their own post images` |
| `posts/caption` | `posts.functions.ts` → `updatePostCaption` | **Not an AI endpoint.** The mobile name is misleading — it is a plain caption UPDATE on an own post | `Users can manage their own posts` |

Already direct in mobile today and unaffected: profile read/update, outfit history, saved palettes,
concierge persistence, subscriptions and entitlements reads, storage uploads. Auth already bypasses
the adapter via the Supabase transport (`services/api/auth.ts`).

### B. Must stay `/api/v1` (14)

| Endpoint | Escalates because | Hard evidence |
| --- | --- | --- |
| `look/generate` | Gemini key + credit | `consume_ai_credit` is `REVOKE`d from `authenticated`, `GRANT`ed to `service_role` only |
| `look/image` | Cloudflare token + credit | same grant |
| `analysis/outfit` | Gemini key + credit | `analyze-outfit.functions.ts` → `ai.server` |
| `concierge/chat` | Gemini key + credit | `concierge-chat.functions.ts` → `ai.server` |
| `dupes/similar` | **Shared ranking logic**, not a secret — see correction below | `findSimilarItems` → `rankDupes` → `scoreCandidate` |
| `items/analyze` | Gemini key | `outfit-items.functions.ts` → `aiChatCompletion` |
| `posts/feed` | Privileged read | `loadAuthorDetails()` reads **other users'** `profiles.full_name` + `subscriptions`; `profiles` SELECT is own-row only |
| `profile/member` | Privileged read | same — no policy grants reading another member's profile |
| `account/delete` | Admin | `auth.admin.deleteUser` |
| `support/message` | hCaptcha secret + rate limit + no user INSERT policy | `check_rate_limit` is `service_role` only; `support_messages` grants only admin/moderator |
| `billing/checkout-url` | Paddle secret | `subscriptions.functions.ts` |
| `billing/sync` | Paddle secret + admin | `paddle-sync.functions.ts` |
| `billing/cancel` | Paddle secret | `subscriptions.functions.ts` |
| `billing/resume` | Paddle secret | `subscriptions.functions.ts` |

### Correction — `dupes/similar` (found in Phase 4)

The first pass attributed this to the Gemini key by reading `dupe-hunter.functions.ts` as a whole.
That file holds **two** functions, and mobile calls the cheap one:

- `findDupes` — vision call, charges a credit. Used by the *website's* studio drawer only.
- `findSimilarItems` — what `/dupes/similar` maps to. No AI, no credit, just `rankDupes` over
  `products`, which `Authenticated can view products` already permits.

It stays on `/api/v1` anyway, for a different reason: **`scoreCandidate` is shared business logic.**
Porting the ranking to the client would mean the same garment returns different matches on web and
on phone — the colour-engine argument in AGENTS.md §5, applied to matching. This is the one endpoint
in group B that is there for logic rather than a secret.

### Correction — `posts/create` (found in Phase 5)

Classified direct on the strength of "user-scoped client only". That was true but not sufficient.
`createPost` carries a check RLS does not express:

```ts
// Storage RLS only constrains uploads. Without this a member could publish a
// post pointing at someone else's image path and claim it as their own OOTD.
const ownsBothImages = [data.image_path_back, data.image_path_front].every((path) =>
  path.startsWith(`${userId}/`),
);
```

The `posts` INSERT policy checks `user_id`; it says nothing about `image_url_back`. Moving the insert
to the client would move that check to the client, where it is not a security control at all — a
member could publish someone else's photo as their own OOTD. So `posts/create` **stays on
`/api/v1`**. A `WITH CHECK` on the image path would let it go direct, but that is a schema change,
which §8 forbids for mobile's benefit.

`posts/delete` was re-verified and is genuinely direct: read own row, delete own row, purge own
storage objects, all under existing policies.

### Note on `posts/feed` and `profile/member`

These two are the only ones that escalate purely for a **read** rather than a secret. They could
become direct with a narrow RLS policy exposing the public author fields, or a view. That is a schema
change, which AGENTS.md §8 forbids doing for mobile's benefit, so they stay on the API for now.
Worth revisiting deliberately with the web owner — it would remove the last two non-secret routes.

## What this changes about the plan

- `look/save` and `items/update` need **no backend work** — mobile-side changes only.
- `posts/create`, `posts/delete` and `posts/caption` likewise.
- The API surface is 14 routes, not 22, and 6 of those share one auth + credit + error shape, so the
  marginal cost after the first is small.

## Shared-service extraction

Every route in group B wraps logic that already exists. The refactor lifts the body of each server
function into `src/server/services/*`, and **both** the existing `createServerFn` and the new REST
route call it — one implementation of each business rule. No prompt, credit calculation, or Paddle
call is copied.

```text
web client ──> createServerFn ──┐
                                ├──> src/server/services/generate-look.ts
mobile ──────> POST /api/v1 ────┘
```

## Open items

1. **The website's deployed origin** is unknown from the repo — needed for `EXPO_PUBLIC_API_BASE_URL`.
2. **Phase 2 onward happens in `MILA/app`**, a different repository. `AGENTS.md` governs
   `MILA_MOBILE` only; the web repo's own conventions apply there.
