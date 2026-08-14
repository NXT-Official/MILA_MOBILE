# Phase 10 — Endpoint status

> Output of Prompt 0 in [`phase-10-verification-prompts.md`](./phase-10-verification-prompts.md).
> Re-run and replace this file whenever the adapter layer moves.

## Result: the `/api/v1` adapter layer does not exist

No request was sent, because none could succeed. `EXPO_PUBLIC_API_BASE_URL` in `.env.local` is
**`https://placeholder.mila.app`** — a placeholder, not a deployment. `.env.local` says so itself:

> The /api/v1 adapter layer does not exist yet (architecture Appendix B).
> Until it does, auth uses the Supabase transport — see services/api/auth.ts.

This matches Appendix B, which lists 22 routes still "to create".

| Endpoint | Used by | Status |
| --- | --- | --- |
| `POST /auth/sign-in` | Phase 01 | Bypassed — `services/api/auth.ts` uses the Supabase transport directly |
| `POST /auth/sign-up` | Phase 01 | Bypassed — as above |
| `POST /look/generate` | Phase 04 | **Unreachable** — base URL is a placeholder |
| `POST /look/image` | Phase 04 | **Unreachable** |
| `POST /look/save` | Phase 04 | **Unreachable** |
| `POST /analysis/outfit` | Phase 05 | **Unreachable** |
| `GET /posts/feed` | Phase 06 | **Unreachable** |
| `POST /posts/create` | Phase 06 | **Unreachable** |
| `POST /posts/caption` | Phase 06 | **Unreachable** |
| `POST /posts/delete` | Phase 06 | **Unreachable** |
| `GET /profile/member` | Phase 06 | **Unreachable** |
| `POST /items/analyze` | Phase 06 | **Unreachable** |
| `POST /items/update` | Phase 06 | **Unreachable** |
| `POST /dupes/similar` | Phase 06 | **Unreachable** |
| `POST /concierge/chat` | Phase 07 | **Unreachable** |
| `POST /account/delete` | Phase 08 | **Unreachable** |
| `POST /support/message` | Phase 08 | **Unreachable** |
| `POST /billing/checkout-url` | Phase 09 | Not built — blocked on Appendix D.1 |
| `POST /billing/sync` | Phase 09 | Not built — blocked on Appendix D.1 |
| `POST /billing/cancel` | Phase 09 | Not built — blocked on Appendix D.1 |
| `POST /billing/resume` | Phase 09 | Not built — blocked on Appendix D.1 |

## What still works without the adapter layer

Direct Supabase access is unaffected and is reachable, because `EXPO_PUBLIC_SUPABASE_URL` is real:
`profiles`, `user_entitlements`, `outfits`, `saved_palettes`, `subscriptions`, `subscription_plans`,
`concierge_conversations` / `concierge_messages`, and storage uploads to `outfits/`.

So the surfaces that can be exercised on a device today are: **launch and session gate, auth,
onboarding, Studio, saved palettes, history reads and deletes, theme, and the membership status and
plan cards.** Everything with an AI call, a feed, a post, a chat turn, an export, or an account
deletion cannot be.

## Consequence

**Prompt 4 (device matrix) cannot meaningfully run yet.** Roughly two thirds of the app's functions
depend on routes that do not exist, and a device pass against them would produce a page of failures
that say nothing about the client. Stand the adapter layer up first, re-run Prompt 0, then run
Prompt 4.

No response shape could be diffed against the TypeScript types in `services/api/*`, so **every one of
those types is still unverified against a real payload.** That is the single largest untested risk in
the codebase.
