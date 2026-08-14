# Phase 10 — Function recheck prompt

> One prompt. Paste it whole. It walks every feature built in Phases 00–09 on a real device and
> reports what works, what does not, and what cannot be checked yet.
>
> For the separate job of *writing* the missing test suite, see
> [`phase-10-verification-prompts.md`](./phase-10-verification-prompts.md).

---

```text
Read AGENTS.md first and follow it strictly.

Read docs/mobile-architecture.md §3 (screen inventory) and §6 (error codes),
and docs/phases/phase-10-testing-release.md (release-gate checklist).

Recheck every mobile function built in Phases 00–09 on a real Android device
and report the true state of each.

This is a VERIFICATION pass, not a build. You are not fixing anything and you
are not adding features. You are finding out what actually works.

── Before you start ──────────────────────────────────────────────────────────

Establish the ground truth, because most of the app talks to a backend that
may not be finished:

  1. Run: npm run typecheck && npm run lint && npm test && npm run scan:secrets
     Record the result of each. These are the only things currently proven.
  2. Confirm EXPO_PUBLIC_API_BASE_URL points at a reachable backend, and
     issue one authenticated request per §6 endpoint with a test-account JWT.
     Record which return a real response and which 404.
  3. Build and install a dev build on a real device. An emulator result is
     not a device result — say so if that is all you have.

Every /api/v1 route except /auth/* and /look/* was written against a
documented contract and has never returned a live response. If an endpoint is
missing, the feature that uses it is BLOCKED, not FAILED. Do not report a
missing backend as broken client code, and do not add a mock to make it look
like it passes.

── What to walk ──────────────────────────────────────────────────────────────

For each function below: perform it, observe it, and record PASS / FAIL /
BLOCKED with one line of evidence. A screenshot or an actual value beats an
adjective.

  1  Launch      cold start, splash, session restore, gate routes correctly
                 (signed out → login, incomplete profile → onboarding,
                 suspended → /suspended, complete → tabs)
  2  Auth        sign up, sign in, hCaptcha challenge, Google sign-in,
                 forgot password, sign out clears the cache and returns to
                 login
  3  Onboarding  all 9 steps, autosave after each answer, kill the app
                 mid-flow and confirm it resumes at the right step, review
                 completes and releases the gate
  4  Home        greeting, weather widget, hub change, vibe picker, generate
                 a look (1 credit), image arrives, save to history, daily
                 palette, pin a palette
  5  History     grid loads, look detail opens, delete works
  6  Lens        permission granted / denied / blocked (blocked must deep-link
                 to settings, not re-prompt), capture, gallery pick, retake,
                 analyse, result card, saved to history, hardware back mid-
                 capture confirms discard
  7  Feed        feed loads with both images per post, pull-to-refresh, empty
                 state, publish flow (rear → front → caption → publish),
                 tagging sheet opens only when garments were found, garment
                 hotspot → detail sheet → find similar, long-press own post →
                 edit caption / delete, member profile opens
  8  Concierge   send a message, reply arrives, both persist, kill the app and
                 relaunch to confirm history survived, conversation list
                 switches threads, anchored look from Look detail renders and
                 clears, composer never covered by the keyboard
  9  Studio      dossier renders, every row opens its editor and saves back,
                 retake colour analysis, saved palettes strip and full list,
                 palette delete
 10  Settings    account (change email, change password with wrong-password
                 rejection), default location, privacy (export a file, delete
                 an account on a THROWAWAY login), support form with captcha,
                 theme preference survives a cold start
 11  Membership  plan cards render with correct prices, membership status row,
                 credits meter. Checkout / cancel / resume are NOT built —
                 they are blocked on Appendix D.1. Record as BLOCKED, not
                 missing.

── Cross-cutting, on every screen you touch ──────────────────────────────────

  - Hardware back: does it do the right thing on every screen, modal, sheet?
  - Offline: turn the radio off. Every AI action disables with honest copy
    and re-enables on reconnect. Nothing crashes.
  - Errors: trigger as many §6 codes as you can and record how each presented.
    INSUFFICIENT_CREDITS must open the paywall sheet, never a toast.
  - Credits: the balance is only ever displayed. Confirm nothing decrements
    it locally and nothing branches on it client-side.
  - Layout: 1.3× font scale, and a screen narrower than 360dp.
  - TalkBack on the primary flow: icon-only controls announce, and the season
    tag always reads its season name beside the swatch.

── Start with these ──────────────────────────────────────────────────────────

Known-weak and never verified. If time is short, these first:

  1. Concierge composer vs. the keyboard — test on gesture navigation AND a
     button navigation bar. It uses KeyboardAvoidingView behavior="padding"
     on both platforms and has never been seen on hardware.
  2. Feed scroll and memory across ~80 posts on a 2 GB device.
  3. A signed URL expiring mid-session — leave the app open past an hour,
     then scroll the feed. Images should refetch, not break.
  4. Data export through the share sheet — first real use of services/files/.
  5. Account deletion end to end, on a throwaway account.
  6. Camera permission "blocked" (Android don't-ask-again).

── Record ────────────────────────────────────────────────────────────────────

Write docs/phases/phase-10-recheck-results.md:

  | # | Function | Result | Device | Evidence |

Then a short list of every defect found, ranked by severity, each with the
steps to reproduce. Numbers where numbers apply — cold start time, frame
rate, peak memory. "Feels fine" is not a measurement.

Do not:
  - Fix anything during the pass. Record it, finish the walk, then fix in a
    separate change with a test that fails without the fix
  - Report a function as PASS on the strength of reading the code
  - Report BLOCKED as FAIL, or a missing endpoint as a client bug
  - Add mock data, a test button, or a bypass to get past a blocker
  - Mark anything verified that you did not personally observe on the device

Verify before you report:
  - Every one of the 11 functions has a recorded outcome
  - Every cross-cutting item has a recorded outcome
  - The four gates (typecheck, lint, test, scan:secrets) are recorded
  - Anything you could not check says so, and says why
```
