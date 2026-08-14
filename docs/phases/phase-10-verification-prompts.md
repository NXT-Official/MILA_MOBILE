# Phase 10 — Verification Prompts

> Companion to [`phase-10-testing-release.md`](./phase-10-testing-release.md). That file is the plan;
> this one is the set of prompts that executes it. Rules still live in [`AGENTS.md`](../../AGENTS.md).

Run these **in order**. Each is independently runnable and sized to one working session, per the §4
rule that a prompt covering more than one feature is two prompts. Prompt 0 gates the rest: several
later checks are impossible until it comes back.

---

## State of play — read before writing any prompt

Being honest about this is the difference between a verification pass and a rehearsal.

| Claim | Reality |
| --- | --- |
| Phases 05–09 work | **Unverified on hardware.** They pass `typecheck`, `lint`, `test`, and `scan:secrets`, and the Android bundle exports. None of it has run on a device. |
| The app talks to a backend | **Unverified.** `/analysis/outfit`, `/posts/*`, `/items/*`, `/dupes/similar`, `/concierge/chat`, `/account/delete`, `/support/message` are Appendix B "routes to add". They were built against the documented contract and have never returned a real response. |
| There is a test suite | 232 tests, 14 suites — **all pure logic**. Zero service tests. Zero component tests. |
| The colour engine is protected | **It is not.** `lib/color-analysis/*` has no test at all, and it is the top item in Phase 10 task 1: copied from web, determinism *is* the product. |
| Phase 09 is done | **No.** Blocked on Appendix D.1. Checkout, cancel, resume, and sync are deliberately unbuilt. |

Untested pure modules, for Prompt 1's scope: `lib/color-analysis/paletteGenerator.ts`,
`seasonsData.ts`, `schemaMigration.ts`, `lib/auth-input.ts`, `lib/season-id.ts`,
`lib/style-profile/studio-dossier.ts`, `utils/relative-time.ts`, `utils/format-price.ts`.

---

## Prompt 0 — Backend reality check

**Run this first.** Prompts 4 and 5 are largely wasted effort until it returns.

```text
Read AGENTS.md first and follow it strictly.

Read docs/mobile-architecture.md §6 (endpoint inventory) and Appendix B.

Establish which /api/v1 endpoints actually exist and respond, and record it.

Requirements:
  - For every endpoint in §6, issue one authenticated request against the
    configured EXPO_PUBLIC_API_BASE_URL with a real test-account JWT.
  - Record for each: reachable / 404 / auth-rejected / shape-mismatch.
  - Where a response arrives, diff its shape against the TypeScript type in
    services/api/* and report every discrepancy. A field the client reads and
    the server does not send is a runtime crash waiting on a device.
  - Confirm the `outfits` bucket is public and the `posts` bucket is private,
    and that a posts URL from /posts/feed is a working 1-hour signed URL.
  - Write the results into docs/phases/phase-10-endpoint-status.md as a table.

Do not:
  - Change any client code to match a server shape without flagging it first
  - Create, delete, or mutate data on a non-test account
  - Add a mock layer to make something look like it works

Verify:
  - The status table is complete, with one row per §6 endpoint
  - Every discrepancy is listed, even the cosmetic ones
```

---

## Prompt 1 — Copied-logic drift tests

Phase 10 task 1. The highest-value tests in the project: this is code that exists in two repos and
must not diverge.

```text
Read AGENTS.md first and follow it strictly.

Read docs/mobile-architecture.md Appendix A (verbatim copy manifest) and
docs/phases/phase-10-testing-release.md §Testing strategy.

Backfill unit tests for the copied pure logic that has none.

Requirements:
  - lib/color-analysis/* first: the 16-season engine. Assert determinism —
    the same input yields the same season every time — and pin the season
    matrix against the web's own tests at /Users/user/nxt/MILA/app/src.
    Two members with identical portraits getting different seasons is the
    exact failure this prevents.
  - Then: lib/auth-input.ts, lib/season-id.ts,
    lib/style-profile/studio-dossier.ts, utils/relative-time.ts,
    utils/format-price.ts.
  - Where the web has an equivalent test file, port its cases rather than
    inventing new ones — a case the web asserts is a case that must not drift.
  - Tests in __tests__/, named *-test.ts.

Do not:
  - Test layout, snapshots, or anything a type already guarantees
  - Modify any file under the Appendix A copy manifest to make a test pass —
    if a copied file is wrong, report it; the fix belongs upstream on the web
  - Add a test framework or dependency

Verify:
  - npm run typecheck && npm run lint && npm test all pass
  - Every module named above has coverage of its real branches
  - Report any behaviour where mobile and web already disagree
```

---

## Prompt 2 — Service-layer tests

Phase 10 task 2. `services/api/client.ts` decides whether a member sees a paywall or a dead end, and
it currently has no test.

```text
Read AGENTS.md first and follow it strictly.

Read docs/mobile-architecture.md §6 (error codes, the fetch client) and
src/services/api/client.ts and errors.ts.

Add service tests covering every branch of the API client.

Requirements:
  - All eight §6 error codes map to the right FailureKind. INSUFFICIENT_CREDITS
    must resolve to "paywall" and must never fall into the generic handler.
  - The single-retry 401 path: one refresh attempt, then give up. Assert it
    cannot loop.
  - Timeout vs. network failure are distinguished — an aborted signal is
    TIMEOUT, a dead socket is NETWORK. They carry different copy on purpose.
  - Per-endpoint timeouts from TIMEOUTS are actually applied.
  - The SecureStore chunking round-trip in services/supabase/client.ts:
    a session larger than 2048 bytes writes, reads back identical, and a
    partial write reads as absent rather than as a truncated token.
  - Mock fetch and SecureStore. Do not call a real endpoint.

Do not:
  - Add a mocking library — jest's own mocks are enough
  - Change client.ts behaviour to make a test simpler
  - Log a token, an email, or image data in a test fixture

Verify:
  - npm run typecheck && npm run lint && npm test all pass
  - Every branch in client.ts is exercised
```

---

## Prompt 3 — Component and state tests

Phase 10 task 3. Sparse and deliberate — primitives and the five states, not every screen.

```text
Read AGENTS.md first and follow it strictly.

Read docs/mobile-architecture.md §11 (component specs, accessibility) and
§10 (mobile UI rules).

Add component tests for the UI primitives and the five screen states.

Requirements:
  - components/ui/* variants render: Button (all five variants + loading +
    disabled), Badge, Chip, Input (error/focus), SeasonTag, CreditsMeter,
    SettingsRow.
  - The five states wherever a component owns them: loading, empty, error,
    success, blocked.
  - Accessibility: every icon-only control has an accessibilityLabel, and
    every interactive element has an accessibilityRole. Assert this — it is
    the checklist item most likely to rot silently.
  - SeasonTag must always render the season name beside the swatch. That is
    the Colour-Is-Content rule and it is normative, not stylistic.
  - Screens only where one owns a decision: the session gate in
    app/_layout.tsx, and the paywall trigger.
  - @testing-library/react-native is already installed. Use it.

Do not:
  - Write snapshot tests — they break on every design change and assert
    nothing about correctness
  - Test third-party internals
  - Add a screen test that only re-asserts what a type guarantees

Verify:
  - npm run typecheck && npm run lint && npm test all pass
```

---

## Prompt 4 — Device matrix and performance

Phase 10 tasks 6, 7, 10. **Needs Prompt 0 green** and real hardware. This is the one that cannot be
faked.

```text
Read AGENTS.md first and follow it strictly.

Read docs/phases/phase-10-testing-release.md §Device testing matrix,
§Performance targets, and the Android release-gate checklist.

Run the device matrix and record results.

Requirements:
  - Run the five device classes in the matrix. For each, walk the primary
    flow: sign in → onboarding → generate a look → save → Lens capture →
    analyse → feed → publish → concierge turn → settings → export.
  - Record numbers, not impressions. Cold start to first interactive frame,
    feed scroll frame rate across 80 posts, peak memory during
    capture → analyse → return, and generated-image display stall.
    "Feels fine" is not a measurement.
  - Trigger every §6 error code at least once on a device and record how it
    presented.
  - Permissions: camera, photo library, location, notifications — each of
    grant, deny, and block, including the Android canAskAgain: false path.
  - Hardware back on every screen, modal, and sheet.
  - TalkBack on the primary flow; reduced motion; 1.3× font scale.
  - Write results to docs/phases/phase-10-device-results.md.

Start with these, which are known-weak and untested — see the list below.

Do not:
  - Fix anything you find in this pass. Record it, finish the matrix, then
    fix in a separate change with a test that fails without the fix
  - Report a checklist item as passing on one device as if it passed on all
  - Test on an emulator and record it as a device result

Verify:
  - Every matrix row and every release-gate checkbox has a recorded outcome
  - Failures are written down as precisely as passes
```

### Known weak points — test these first

Ranked by how likely they are to be wrong, from what was built in phases 05–09:

1. **Concierge composer vs. the keyboard** (Phase 07). Uses RN core `KeyboardAvoidingView` with
   `behavior="padding"` on both platforms, because Reanimated 4.5.1 deprecates `useAnimatedKeyboard`.
   Never verified. Test on **gesture navigation and a button navigation bar** — the phase doc calls
   this out specifically.
2. **Feed memory across 80 posts** (Phase 06). `FlatList` was chosen over `FlashList` deliberately;
   the OOM guard is `recyclingKey` on `expo-image`. This is the decision to revisit if the low-end
   device struggles.
3. **Expiring signed URLs** (Phase 06). `RemoteImage` refetches the parent query once per URL on any
   load error. Leave the app open past one hour, then scroll the feed.
4. **Data export share sheet** (Phase 08). First real use of `services/files/`. On Android
   `saveAndShare` always reports `"shared"` — the intent gives no completion callback.
5. **Account deletion end to end** (Phase 08). Irreversible, App Store blocker, needs a throwaway
   account. Verify billing cancels, storage purges, and the app signs out cleanly.
6. **Camera permission "blocked"** (Phase 05). `canAskAgain: false` must deep-link to system
   settings, not re-prompt into a void.
7. **Low-end capture** (Phase 05). Downscale happens inside the adapter; the OOM window is the sensor
   -size bitmap. 2 GB device, capture → analyse → return.

---

## Prompt 5 — Release hardening

Phase 10 tasks 8, 9, 11. Independent of the device pass; can run in parallel with Prompt 4.

```text
Read AGENTS.md first and follow it strictly.

Read docs/mobile-architecture.md §10 (release hardening, secrets, privacy)
and §12 (build and release), plus src/platform/ios/README.md.

Harden the build and verify iOS readiness without shipping iOS.

Requirements:
  - Strip development utilities: test buttons, console.log, mock data,
    storage clearers. Grep for them; do not rely on memory.
  - Run npm run scan:secrets against a PRODUCTION export, not a dev bundle,
    and scan git history for the same patterns.
  - Confirm usesCleartextTraffic is false and remote debugging is off in
    release.
  - Verify the state rules by inspection: no Zustand store holds server data,
    every mutation invalidates explicitly by key, no bare invalidateQueries(),
    no mutation auto-retries.
  - iOS readiness: every adapter has an .ios.ts of the same shape and the
    project type-checks with moduleSuffixes set to .ios. Confirm the four
    Info.plist usage strings and the HEIC path in camera.ios.tsx.
  - Update src/platform/ios/README.md and android/README.md with anything
    learned.

Do not:
  - Add crash reporting in this prompt — it is its own change, and §10
    requires token/email/image scrubbing that needs its own review
  - Build or submit anything to a store track
  - Remove a "development utility" that turns out to be a real feature

Verify:
  - scan:secrets passes against the production bundle and git history
  - tsc passes with moduleSuffixes [".ios", ""] as well as [".android", ""]
  - Report anything that cannot be verified rather than marking it done
```

---

## What these prompts deliberately leave out

- **Crash reporting** (task 5) — an addition, not a verification, and its scrubbing requirement
  deserves its own review.
- **EAS production build, store listing, internal track, real-user feedback** (tasks 12–14) — release
  execution, gated on the device pass coming back clean.
- **Maestro end-to-end** (task 4) — optional in the phase doc. Worth it only once Prompt 0 is green
  and the flow is stable; before that it will fail for environmental reasons and teach nothing.
- **Anything in Phase 09 past the plan cards** — still blocked on Appendix D.1.
