# Phase 09 — Membership Payment

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §7 credit model, §9 payment
> integration, §15 Phase 9, Appendix D.1.

> ### Superseded by a final product decision — mobile checkout will not be built
>
> **Appendix D.1 — Paddle web checkout vs. native IAP — is decided.** Paddle stays web-only,
> permanently. Mobile shows entitlement status read-only — plan, renewal/end date, and credits — and
> never gets a purchase, cancel, or resume affordance. `MembershipScreen` and `PlanCard` already ship
> the decided version.
>
> Everything below this notice describes the checkout implementation that was **planned** before the
> decision and is kept as the historical record of what was considered — the rationale for why a Paddle
> web checkout risked App Store/Play Store rejection is still the correct rationale, it is just no
> longer a question this phase resolves by building around it. **Tasks 3, 5, 6, 8, 9, 11, and 12 below,
> and the Paddle-sandbox checkout items in the Testing Checklist, do not apply to mobile and will not be
> implemented here.** Nothing in this phase should be started on the strength of the old "blocked,
> pending decision" framing; the decision has been made and it is "no."

## Goal

Implement monetization: plans, checkout, membership status, and credits — with the device never
believed about any of it.

---

## User Outcome

A member can see what each plan gives her, pay for one, and have her credits and access appear
without doing anything else. She can cancel and keep access until the period ends, or resume before
it does. She always knows which state she is in and when it changes.

---

## Scope

- Plan cards from `subscription_plans` (active, non-archived), single column, ordered
- Paddle hosted checkout in a system browser via `expo-web-browser`
- Post-checkout sync, invalidate, then a re-check after 5 seconds
- Manage membership: current plan, renewal or end date, cancel, resume
- Credits meter
- Upgrading the Phase 03 read-only plan list into the real thing

---

## Not Included

- Native in-app purchase. Appendix D.1 is decided against it — Paddle stays web-only, permanently —
  so this is not a pending branch; native IAP will not be added to mobile
- Any client-side entitlement calculation
- Promo codes, trials, or plan management beyond cancel and resume
- Invoice history or receipts

---

## Non-negotiable rules for this phase

1. **Never trust payment status from the device.** Checkout completion on the phone is a *hint to
   refresh*, not a grant. Entitlement is whatever `subscriptions` and `user_entitlements` say.
2. **`custom_data.user_id` is the attribution key** and is set server-side when minting the checkout
   URL. It is never accepted from the client.
3. **The sync endpoint verifies ownership.** A transaction whose `custom_data.user_id` differs from
   the caller is rejected. Without this, anyone could claim another member's payment.
4. **The webhook is the system of record.** Renewals, dunning, refunds, and cancellations arrive only
   there. Sync exists solely to make activation feel instant.
5. **Card data never enters the app.** The checkout runs in a system browser
   (Chrome Custom Tabs / SFSafariViewController), which keeps the app out of PCI scope.
6. **No payment logic in UI.** Screens render state; they never decide entitlement.

---

## Implementation Tasks

Ordered. Each task is one commit.

1. ~~Confirm Appendix D.1 is decided and recorded.~~ **Decided: Paddle stays web-only,
   permanently.** The checkout-implementation tasks below (3, 5, 6, 8, 9, 11, 12) are historical
   record of the plan that predates this decision and do not apply to mobile.
2. **Copy `lib/subscription-plans.ts` and `constants/subscriptions.ts` verbatim** — price formatting,
   interval labels, and `IN_FORCE_SUBSCRIPTION_STATUSES`.
3. **Write `services/api/billing.ts`** — `getCheckoutUrl`, `syncPaddlePurchase`,
   `cancelMySubscription`, `resumeMySubscription`.
4. **Upgrade the plan list** from Phase 03's read-only version: real plan cards with title, price via
   `Intl.NumberFormat` from minor units, interval suffix, daily credits, feature list, and CTA.
   Single column — not the web's three-column grid. At most one featured plan.
5. **Write `services/checkout.ts`** — `POST /billing/checkout-url` →
   `WebBrowser.openAuthSessionAsync(url, "mila://checkout-return")` → read `transaction_id` → sync.
   **A missing transaction id is not a failure** — the webhook still lands; refresh and let
   entitlement arrive on its own.
6. **Handle the post-checkout refresh** — invalidate `credits` and `mySubscription`, then re-check
   after 5 seconds to catch a webhook that lands a moment later. Optimistic copy: *"Payment received —
   your plan will appear shortly."*
7. **Build the manage screen** — current plan, status, renewal or end date, credits meter.
8. **Build cancel** — `effective_from: next_billing_period`. The copy must state that access
   continues until the period ends; cancelling is not losing access today.
9. **Build resume** — clears the scheduled change.
10. **Render statuses correctly.** `cancel_at_period_end` drives "Renews on *date*" versus "Ends on
    *date*". `past_due` is deliberately in force — a failed payment retry must not lock a paying
    member out mid-dunning.
11. **Wire the paywall.** `PaywallSheet` from Phase 03 now routes into the real checkout.
12. **Test the whole flow in the Paddle sandbox**, including the tampered-attribution case.

---

## Screens

| #   | Screen            | Route                | Notes                                             |
| --- | ----------------- | -------------------- | ------------------------------------------------- |
| 14  | Membership plans  | `/membership`        | Upgraded from Phase 03's read-only list           |
| 15  | Manage membership | `/membership/manage` | Current plan, renewal date, cancel, resume        |
| —   | Paddle checkout   | System browser       | `expo-web-browser` — never an in-app WebView form |

---

## Components

`PlanCard` · `FeaturedPlanBadge` · `CreditsMeter` · `MembershipStatusRow` · `CancelSheet` ·
`ResumeSheet` · `CheckoutPendingState`

Reused: `Card`, `Button`, `Sheet`, `ConfirmSheet`, `PaywallSheet`, `Badge`, `EmptyState`.

---

## Services / Integrations

| Endpoint                     | Auth | Notes                                                           |
| ---------------------------- | ---- | --------------------------------------------------------------- |
| `POST /billing/checkout-url` | yes  | **New server logic** — mints the URL with `custom_data.user_id` |
| `POST /billing/sync`         | yes  | `{ transactionId }` → verifies ownership → upserts              |
| `POST /billing/cancel`       | yes  | `effective_from: next_billing_period`                           |
| `POST /billing/resume`       | yes  | Clears the scheduled change                                     |
| `POST /api/webhooks/paddle`  | —    | **Already exists. Unchanged.** The system of record             |

Also used: `expo-web-browser` for the hosted checkout, and direct Supabase reads for
`subscription_plans` and `subscriptions`.

`/billing/checkout-url` is the only new business logic in the entire adapter layer. It verifies the
caller, confirms the price belongs to an active non-archived plan, and returns a Paddle-hosted URL
carrying the caller's id and a `mila://checkout-return` success URL.

---

## Database Requirements

| Table                | Access        | How                                                                                     |
| -------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `subscription_plans` | read active   | Direct — `is_active AND archived_at IS NULL`, ordered by `sort_order` then `created_at` |
| `subscriptions`      | read own      | Direct                                                                                  |
| `user_entitlements`  | **read only** | Direct — credits meter                                                                  |
| `purchases`          | **never**     | Not touched by mobile in any form                                                       |

`IN_FORCE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"]` — copied verbatim.

At most one plan is featured, enforced by a partial unique index in the database. Do not enforce it
client-side as well.

No schema change. The webhook, credit grants, and entitlement writes are all existing server
behaviour.

---

## State Requirements

| Query / store            | Stale time | Refetch triggers                             |
| ------------------------ | ---------- | -------------------------------------------- |
| `subscriptionPlans`      | 60 s       | Screen focus                                 |
| `mySubscription(userId)` | 0          | App foreground, after checkout/cancel/resume |
| `credits(userId)`        | 0          | App foreground, after checkout               |

After `startCheckout` resolves, invalidate `credits` and `mySubscription`, then re-check after 5
seconds. **No optimistic entitlement state exists anywhere** — there is nothing to roll back because
nothing is ever assumed.

---

## Testing Checklist

All payment testing runs in the **Paddle sandbox**.

- [ ] **Checkout:** pick a plan → hosted checkout opens in the system browser → return to the app
- [ ] **Successful payment:** entitlement and credits appear after sync
- [ ] Returning **without** a `transaction_id` still lands the entitlement via the webhook
- [ ] **Failed payment:** a declined card leaves state untouched and the member is not charged access
- [ ] Dismissing the checkout mid-flow leaves state untouched
- [ ] **Membership refresh:** killing the app after checkout and relaunching shows the correct state
- [ ] Cancel: access continues to period end; the copy says so; status reads "Ends on *date*"
- [ ] Resume clears the scheduled change and restores "Renews on *date*"
- [ ] `past_due` keeps the member in force — not locked out mid-dunning
- [ ] A tampered client cannot claim another member's transaction (server rejects on attribution)
- [ ] Prices render from minor units via `Intl.NumberFormat` with the correct interval suffix
- [ ] Credits granted on renewal appear after a webhook, with no app action
- [ ] The paywall from Phase 04 routes into checkout and returns to where it was opened from
- [ ] No card field, token, or Paddle key exists anywhere in the app — `scan:secrets` passes
- [ ] Android hardware back from the system browser returns cleanly

---

## Definition of Done

Users can purchase and access membership features:

- Sandbox purchase, cancel, and resume are exercised end to end on a real device
- **Entitlement always comes from Supabase**, never from a device signal
- No payment state is computed, cached optimistically, or trusted client-side
- Appendix D.1 is decided and recorded: Paddle stays web-only, permanently — nothing further needed
  here before store submission on this point
- Phase 00–08 gates still pass, and §17 of the architecture doc passes
