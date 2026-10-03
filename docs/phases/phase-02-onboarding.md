# Phase 02 — User Onboarding

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §3 onboarding steps, §7 profile
> completeness and column protection, §15 Phase 2, Appendix A copy manifest.

## Goal

Collect the member's initial style profile across nine steps, saving after every answer and resuming
exactly where she left off if she closes the app.

---

## User Outcome

A member finishes onboarding with a complete Mila style profile — colouring, silhouette, face shape,
hair, and optionally beauty preferences and location. She can quit at any point and return to the
same step with her answers intact. A dropped connection never costs her progress.

---

## Scope

- One route (`/(onboarding)/[step]`) driven by the copied step machine — not nine route files
- Nine steps: welcome, colour path, colour result, body type, face shape, hair type, beauty
  preferences, location, review
- Progress indicator reading "Step *n* of 8" (`welcome` is not counted)
- **Autosave after every step**, with a visible save status
- Resume at `getFirstIncompleteOnboardingStep()` on relaunch
- Reachability guard blocking a jump past an incomplete non-optional step
- Device location → nearest weather hub, with confirmation before saving
- Exit on `isStyleProfileComplete()`

---

## Not Included

- Editing the profile after completion → Phase 08 (Studio rows re-enter these same steps in edit mode)
- The Studio dossier surface itself → Phase 08
- Any Home content → Phase 03
- New quiz questions, seasons, or body types. The taxonomy is copied, not designed

---

## Implementation Tasks

Ordered. Each task is one commit.

1. **Copy the domain logic verbatim** (Appendix A). `constants/steps.ts`,
   `constants/style-profile/*`, `lib/color-analysis/*`, `lib/style-profile/completion.ts`,
   `lib/profile-color.ts`, `lib/beauty-preferences.ts`, `constants/wardrobe.ts`,
   `constants/climate.ts`. **Do not rewrite any of it** — rewriting is how two members with identical
   portraits get different seasons.
2. **Unit-test the copied logic first.** Step order, reachability, resume point, and
   `isStyleProfileComplete()` against all six fields. These tests are the contract between the two
   clients.
3. **Build the step machine.** `features/onboarding/machine.ts` +
   `hooks/use-onboarding-machine.ts` — current step, next, previous, reachability, resume.
4. **Build `StepShell`** — the shared frame: title, progress, back, continue. Every step renders
   inside it, which is why nine route files would be wrong.
5. **Build `ProgressBar`** reading `COUNTED_STEPS`, excluding `welcome`.
6. **Build `OptionTile`** — touch target ≥56px, the primary interaction of this phase.
7. **Build `SaveStatus`** — "Saving…" → "Saved", and a visible failure state that does not discard
   the answer.
8. **Build autosave.** `hooks/use-auto-save-profile.ts` — `PATCH profiles` after each answer, sending
   **only the permitted column list**. Retry on reconnect. Never batch to the end.
9. **Build the guard layout.** `(onboarding)/_layout.tsx` — session required, profile incomplete;
   complete → tabs, no session → login.
10. **Build the steps in order:** Welcome → ColorPath → ColorResult → BodyType → FaceShape →
    HairType → BeautyPreferences → Location → Review. One commit per step or per pair.
11. **Wire the location step.** `services/location.ts` — `expo-location`, foreground only,
    `Balanced` accuracy → nearest hub by great-circle distance → **confirm before saving**. Treat
    permission denial as a normal path, not an error.
12. **Wire the Review step** to `isStyleProfileComplete()` and route to `/(tabs)` on success.
13. **Verify resume** by killing the app at each step and relaunching.

---

## Screens

One route, nine steps: `/(onboarding)/[step]`

| Step | `id`                 | Title                       | Optional | Interaction                                    |
| ---- | -------------------- | --------------------------- | -------- | ---------------------------------------------- |
| —    | `welcome`            | Welcome to Mila             | —        | Full-bleed intro, single CTA. Not counted      |
| 1    | `color-path`         | Your colouring              |          | Two tiles: "Analyze my coloring" (live read) / "I know my season" |
| 2    | `color-result`       | Confirm your colour profile |          | Season card, palette swatches, confirm         |
| 3    | `body-type`          | Body silhouette             |          | 5 `OptionTile`s                                |
| 4    | `face-shape`         | Face shape                  |          | `OptionTile` grid                              |
| 5    | `hair-type`          | Hair type                   |          | `OptionTile` grid                              |
| 6    | `beauty-preferences` | Beauty preferences          | ✔        | Multi-select chips                             |
| 7    | `location`           | Location & weather          | ✔        | 10 hubs + "use my location"                    |
| 8    | `review`             | Your Mila profile is ready  |          | Dossier summary + "Enter Mila"                 |

> **The live colour path is open.** The founding read — no colour dossier on file yet — is free;
> re-reads cost 1 AI credit, 10/hour, and an out-of-credits read opens the paywall sheet
> (`INSUFFICIENT_CREDITS`), never a dead end. "I know my season" remains for anyone who would
> rather pick from the library.

---

## Components

`StepShell` · `ProgressBar` · `SaveStatus` · `OptionTile` · the nine step bodies

Reuse from Phase 00/01: `Button`, `Card`, `Input`, `Screen`, `Icon`. New shared primitives this phase
may need: `Chip` (multi-select), `Skeleton`.

---

## Services / Integrations

| Service                    | Used for                                                        |
| -------------------------- | --------------------------------------------------------------- |
| `services/supabase/client` | Direct `profiles` update — permitted columns only               |
| `services/location.ts`     | `expo-location` → nearest hub                                   |
| `services/api/analysis.ts` | `POST /api/v1/analysis/personal-color` — **only** the live path |

The live colour read is the one AI call in this phase. It costs 1 credit, is rate limited, and can
fail with `CONFIG_MISSING_API_KEY`, `ANALYSIS_RATE_LIMITED`, `ANALYSIS_CREDITS_EXHAUSTED`,
`ANALYSIS_PARSING_FAILED`, or `ANALYSIS_GATEWAY_FAILURE`. Map each to member-facing copy; **never
surface the code**.

---

## Database Requirements

| Table      | Access               | Notes                       |
| ---------- | -------------------- | --------------------------- |
| `profiles` | read own, update own | Direct, RLS + column grants |

**Permitted columns only:**

```text
full_name · username · skin_undertone · color_season · body_type ·
color_profile · face_shape · hair_type · beauty_preferences ·
default_location · updated_at
```

Sending `suspended` or `paddle_customer_id` fails the grant — it does not silently no-op.

**Completion gate** — `isStyleProfileComplete()` requires all six: `skin_undertone`, `color_season`,
`body_type`, `face_shape`, `hair_type`, and a non-empty `color_profile`. Do not reimplement the check.

---

## State Requirements

| Owner                     | Holds                                                | Persisted      |
| ------------------------- | ---------------------------------------------------- | -------------- |
| `stores/onboarding-store` | In-flight step answers not yet written to the server | `AsyncStorage` |
| TanStack Query            | `profile(userId)` — the saved truth                  | In-memory      |
| `useState`                | Per-step form interaction                            | —              |

The store holds only what is in flight. Once the server confirms a write, the answer belongs to the
`profile` query and is removed from the draft. Two copies of the same answer is how a resume shows
stale data.

---

## Testing Checklist

- [ ] **Complete onboarding** end to end; `isStyleProfileComplete()` returns true; lands on Home
- [ ] **Exit and resume:** kill the app mid-flow, relaunch — resumes at the first incomplete step
      with answers intact
- [ ] Resume works from every one of the nine steps
- [ ] Deep-link directly to a later step — blocked, redirected to the resume point
- [ ] **Save failure:** airplane mode on a step shows the failure, keeps the answer, and retries on
      reconnect
- [ ] Optional steps can be skipped and the profile still completes
- [ ] Location permission denied is a normal path; the hub list still works
- [ ] Device location resolves to the nearest hub and **asks before saving**
- [ ] `OptionTile` targets measure ≥56px on a real device
- [ ] Progress reads "Step 1 of 8" on the first counted step and never counts `welcome`
- [ ] The live colour path with zero credits fails gracefully and offers the manual path
- [ ] A `suspended` column write is never attempted anywhere in the phase
- [ ] Copied-logic unit tests pass and match the web project's behaviour

---

## Definition of Done

The user has a completed Mila profile:

- A member can finish onboarding and reach Home with all six fields valid
- The flow resumes correctly after a cold start from any step
- A dropped connection never costs an answer
- No domain logic was rewritten — every rule comes from the copied files
- Phase 00–01 gates still pass, and §17 of the architecture doc passes
