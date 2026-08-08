# Phase 03 — Home Experience

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §3 Home detail, §4 bottom tabs, §6
> TanStack Query configuration, §7 credit model, §15 Phase 3.

## Goal

Build the primary Mila surface — the screen the product is judged on — with every state honest,
before a single AI call is wired.

Phase 03 builds the screen. **Phase 04 makes it generate.** The split is deliberate: the states that
decide whether this product feels premium are the loading, empty, blocked, and error ones, and they
get built properly only when they are not competing with the happy path.

---

## User Outcome

A member can enter Mila and see her personalised home: a greeting that knows the time of day, today's
weather for her hub, her chosen vibe, her credit balance, and a clear invitation to compose today's
look. Nothing lies to her — if she cannot generate yet, the screen says why.

---

## Scope

- The bottom tab navigator and its five tabs
- Home dashboard: greeting, climate widget, vibe picker, generate CTA, outfit shell, credits pill
- Daily palette strip
- `PaywallSheet` and a **read-only** `/membership` plan list
- The five states: loading, empty, error, success, blocked
- Weather via Open-Meteo, keyed to the member's hub
- Placeholder routes for the four non-Home tabs

---

## Not Included

- **Any AI call.** The generate CTA renders its loading and error states against a stub → Phase 04
- Look generation, image generation, saving, or history → Phase 04
- Feed, Lens, Studio, Concierge content → Phases 05–08 (placeholders only)
- Paddle checkout. The membership route lists plans read-only; checkout is Phase 09
- Push notifications and the daily reminder

---

## Implementation Tasks

Ordered. Each task is one commit.

1. **Copy `constants/query-keys.ts` verbatim**, minus the five `admin*` keys and `staffGate`.
   Identical keys mean identical invalidation semantics across the two clients.
2. **Copy `constants/climate.ts` and `constants/vibes.ts`** — the 10 hubs with coordinates, the
   weather-code mapping, and the 11 vibes.
3. **Build the tab navigator.** `(tabs)/_layout.tsx` with the five tabs, the §4 styling (ink at 90%
   with blur, accent active tint, 22px icons at stroke 1.75, 10px uppercase labels,
   `56 + insets.bottom` height, top hairline).
4. **Ship placeholder routes** for `feed`, `lens`, `studio`, `concierge`. The navigator declares five
   tabs, so the files must exist or the router throws. Each renders an `EmptyState` naming the phase
   that fills it. Same for `/lens-capture`, which the Lens tab listener pushes.
5. **Build the missing primitives:** `Sheet`, `Skeleton`, `EmptyState`, `LoadingState`, `Badge`,
   `Chip`. Each owns its NativeWind classes; features never restyle them.
6. **Build the hooks:** `use-profile`, `use-credits`, `use-network-status`, `use-app-state`,
   `use-haptics`.
7. **Build `Greeting`** — thresholds `<5h` "Still up", `<12h` "Good morning", `<18h` "Good
   afternoon", else "Good evening". Suffix is the first word of `full_name`, or nothing.
8. **Build `services/weather.ts`** — Open-Meteo fetch for the member's hub coordinates plus
   `climateForWeatherCode`. No API key.
9. **Build `ClimateWidget`** — condition, temperature, hub name; tap opens the hub sheet.
10. **Build `VibePicker`** — a bottom sheet with the 11 vibes, not an inline picker.
11. **Build `CreditsPill`** — renders `ai_credits + purchased_credits` and nothing more. It never
    predicts a reset, never decrements optimistically, and never gates a feature on a local balance.
12. **Build `GenerateButton`** — full width, h=48, disabled with copy for each blocked reason.
13. **Build the `OutfitVisual` and `LookDetail` shells** — 3:4 skeleton → content → retry. Wired to a
    stub in this phase.
14. **Build `PaywallSheet`** and the read-only `/membership` plan list from `subscription_plans`
    where `is_active AND archived_at IS NULL`, ordered by `sort_order` then `created_at`.
15. **Build the blocked states:** profile incomplete, no weather, offline. Disabled with copy —
    **never hidden**.
16. **Configure query refetching:** `credits` on app foreground, `profile` on foreground and after
    mutation. `refetchOnWindowFocus` stays off — use `useAppState` instead.

---

## Screens

| #   | Screen           | Route                                         | Notes                                           |
| --- | ---------------- | --------------------------------------------- | ----------------------------------------------- |
| 5   | **Home**         | `/(tabs)/`                                    | The daily look — the primary screen             |
| 14  | Membership plans | `/membership`                                 | **Read-only in this phase.** Checkout in Ph. 09 |
| —   | Tab placeholders | `/(tabs)/feed`, `lens`, `studio`, `concierge` | `EmptyState` naming the owning phase            |

**Home layout** (single column, vertical scroll): header with wordmark, credits pill, theme toggle,
avatar → greeting → climate widget → vibe picker → primary CTA → outfit visual → headline → three
collapsible sections → action row → today's palette.

---

## Components

**New primitives:** `Sheet` · `Skeleton` · `EmptyState` · `LoadingState` · `Badge` · `Chip`

**Feature components:** `Greeting` · `ClimateWidget` · `VibePicker` · `GenerateButton` ·
`OutfitVisual` · `LookDetail` · `CreditsPill` · `DailyPaletteStrip`

**Feedback:** `PaywallSheet` · `Toast` host

---

## Services / Integrations

| Service                    | Used for                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| `services/weather.ts`      | Open-Meteo fetch + `climateForWeatherCode`. No key, no auth         |
| `services/supabase/client` | Direct reads: `profiles`, `user_entitlements`, `subscription_plans` |
| `services/query-client`    | The §6 defaults, configured in Phase 00                             |

**No AI route is called in this phase.** No `services/api/look.ts` yet.

---

## Database Requirements

| Table                | Access        | How                                       |
| -------------------- | ------------- | ----------------------------------------- |
| `profiles`           | read own      | Direct — greeting name, hub, completeness |
| `user_entitlements`  | **read only** | Direct — writes are service-role only     |
| `subscription_plans` | read active   | Direct — the read-only plan list          |

**Credit model, restated because this is where it gets broken:**

```text
Displayed balance = ai_credits + purchased_credits
```

The app renders that sum and nothing more. The server's `INSUFFICIENT_CREDITS` is the only authority
on whether an action is allowed.

> `DEFAULT_AI_CREDITS = 0` means an unsubscribed member sees a zero balance and a paywall on her
> first tap. Test this phase on both a zero-credit and a seeded account — the zero case is the
> **default** first-run experience, not an edge case.

---

## State Requirements

| Query / store        | Stale time | Refetch triggers                          |
| -------------------- | ---------- | ----------------------------------------- |
| `profile(userId)`    | 5 min      | App foreground, after profile mutation    |
| `credits(userId)`    | 0          | App foreground, after every AI call       |
| `subscriptionPlans`  | 60 s       | Screen focus                              |
| Weather              | 30 min     | Hub change, app foreground                |
| `stores/theme-store` | —          | Persisted (Phase 00)                      |
| Selected vibe        | —          | UI state — Zustand or local, never server |

Invalidate explicitly by key. **Never** call a bare `invalidateQueries()`.

---

## Testing Checklist

- [ ] **Empty state:** complete profile, no look yet — the screen reads as an invitation, not a void
- [ ] **Loading state:** skeletons mirror the final layout; **no bare spinners** anywhere
- [ ] **Error state:** a failed weather fetch degrades to the hub-selection copy, not a crash
- [ ] **Success state:** greeting, weather, vibe, and credits all render correct live data
- [ ] **Blocked:** incomplete profile shows "Complete your Style Profile first." and routes correctly
- [ ] **Blocked:** no weather shows the hub copy; the CTA is disabled, not hidden
- [ ] Offline disables the CTA with the standard copy and re-enables on reconnect
- [ ] Credits pill matches the database value exactly and refreshes on app foreground
- [ ] Zero credits opens `PaywallSheet` — **never a toast**
- [ ] Vibe selection persists through a re-render and reads back on the sheet
- [ ] Greeting is correct at 04:00, 09:00, 15:00, and 21:00 (change the device clock)
- [ ] Tab bar renders at `56 + insets.bottom`; icons `md` / stroke 1.75; Lens presents full-screen
- [ ] Placeholder tabs render their `EmptyState` without error
- [ ] Android hardware back on a tab root behaves per the §12 contract
- [ ] Layout holds at <360dp width and at 1.3× font scale

---

## Definition of Done

The user can access their personalised Mila home:

- Greeting, weather, vibe, credits, and the palette strip render live data on a real device
- All five states are implemented and were triggered deliberately, not assumed
- No locally computed credit value appears anywhere in the code
- The tab navigator is complete and every route resolves
- Phase 00–02 gates still pass, and §17 of the architecture doc passes
