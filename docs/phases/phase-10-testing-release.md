# Phase 10 — Testing and Release

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §10 release hardening, §11
> accessibility, §12 build and release, §15 Phase 10, §17 definition of done.

## Goal

Prepare the production release: a test suite that protects what is expensive to get wrong, a device
pass on real hardware, and an Android production binary that has been tested **as a production
binary** before submission.

---

## User Outcome

Nothing new ships. The outcome is that what already shipped survives contact with real devices, real
networks, and real store review — and that a regression introduced next month gets caught by a test
rather than by a member.

---

## Scope

- Unit tests for pure logic and services
- Component tests for primitives and the five states
- Optional end-to-end coverage of the critical path
- Device testing across the Android matrix
- Performance pass on a low-end device
- Crash reporting with token scrubbing
- EAS production build, internal testing track, store listing
- iOS readiness verification — verified now, shipped later

---

## Not Included

- New features of any kind. If something is missing, it belongs to its own phase
- iOS release. This phase verifies readiness; shipping iOS is a separate effort
- Analytics beyond what §10 permits. If analytics is added: no PII, no image content, and a
  documented disclosure

---

## Implementation Tasks

Ordered.

1. **Backfill unit tests for pure logic** — anything in `lib/`, `constants/`, and `utils/` that a
   phase touched: the colour engine, `isStyleProfileComplete`, the step machine's order,
   reachability, and resume point, credit error identity, price formatting, item URL normalisation,
   and `resolveDestination`. These are copied from web and **must not drift**.
2. **Backfill service tests** — every branch of `services/api/client.ts`: all eight error codes, the
   single-retry 401 path, timeout behaviour, and the SecureStore chunking round-trip.
3. **Backfill component tests** — `components/ui/*` variants, the five screen states, and
   accessibility labels on icon-only controls.
4. **Optionally add one end-to-end flow** — sign in → onboarding → generate → save, via Maestro on
   EAS Workflows. One flow, if the phase budget allows.
5. **Add crash reporting** with breadcrumb scrubbing for tokens, emails, and image data. §10 requires
   the scrubbing; this is where the reporter that needs it finally exists.
6. **Run the device matrix** below and record results, not impressions.
7. **Run the performance pass** — cold start, feed scroll, and generated-image display, measured on
   the low-end device.
8. **Strip development utilities** — test buttons, `console.log`, mock data, the API mock switch,
   storage clearers.
9. **Run `scan:secrets` against the production bundle**, and check git history too.
10. **Run the accessibility pass** — TalkBack on the primary flow, reduced motion, and 1.3× font
    scale.
11. **Verify iOS readiness** without shipping it.
12. **Build the production AAB with EAS**, install it on a real device, and test it there.
13. **Prepare the store listing** and submit to the internal testing track.
14. **Get feedback from real users** before public release.

---

## Testing strategy

The suite exists to protect what is expensive to get wrong, not to reach a coverage number.

| Layer                                           | Tool                            | What is tested                                                                                           | Target                                |
| ----------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Pure logic** (`lib/`, `utils/`, `constants/`) | `jest-expo`                     | Colour engine, profile completeness, step machine, credit errors, price formatting, `resolveDestination` | **High — copied code must not drift** |
| **Services**                                    | `jest-expo` + fetch mocks       | All eight error codes, the single-retry 401, timeouts, SecureStore chunking                              | Every branch in `client.ts`           |
| **Components**                                  | `@testing-library/react-native` | `components/ui/*` variants, the five states, accessibility labels                                        | Primitives + state components         |
| **Screens**                                     | `@testing-library/react-native` | Only where a screen owns a decision: session gate, guards, paywall trigger                               | Sparse and deliberate                 |
| **End to end**                                  | Maestro (EAS Workflows)         | Sign in → onboarding → generate → save                                                                   | Critical path only, optional          |

**Not tested:** layout snapshots (they break on every design change and assert nothing about
correctness), third-party library internals, and anything a type already guarantees.

Tests live in `__tests__/` beside the code they cover, named `*-test.ts(x)`. **Every bug fixed from
here on lands with a test that fails without the fix.**

---

## Device testing matrix

| Device class                         | Must verify                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| Low-end (2 GB RAM, 720×1280, API 26) | Feed scroll, capture + analyse, generated image display — memory and frame rate |
| Mid-range (API 33)                   | The full primary flow; `POST_NOTIFICATIONS` runtime permission                  |
| Flagship (newest API)                | Edge-to-edge, gesture navigation, predictive back                               |
| Small width (< 360dp)                | Compact padding, two-line headings, no clipped CTAs                             |
| Tablet / foldable (> 600dp)          | Content capped at 600dp and centred — **no multi-column layout**                |

---

## Performance targets

Measured on the **low-end** device, not the flagship:

- Cold start to the first interactive frame
- Feed scroll frame rate across 80 posts
- Memory during capture → analyse → return (the OOM path)
- Generated image display without a visible stall

Record the numbers. "Feels fine" is not a measurement, and the next person cannot compare against it.

---

## Screens

None new. This phase touches every screen already built and adds nothing to §3's inventory.

---

## Components

None new. If a component turns out to be missing, it belongs to the phase that owns its surface, not
to this one.

---

## Services / Integrations

| Service         | Added or verified in this phase                                     |
| --------------- | ------------------------------------------------------------------- |
| Crash reporting | **Added**, with token / email / image scrubbing per §10             |
| EAS Build       | Production AAB with `autoIncrement`                                 |
| EAS Update      | Channels separated by profile so preview can never reach production |
| Google Play     | Internal testing track, then staged rollout                         |
| Analytics       | **None today.** If added: no PII, no image content, disclosed       |

A native change requires a new build — new permissions, new native modules, SDK upgrades. **API
contract changes require a version bump**, never a silent breaking change: shipped binaries cannot be
hot-fixed on the server side.

---

## Database Requirements

None new. This phase reads what the earlier phases wrote and verifies the credit and entitlement
arithmetic against `user_entitlements` one final time.

---

## State Requirements

None new. Verify instead that:

- No Zustand store holds server data
- Every mutation invalidates explicitly by key, and none calls a bare `invalidateQueries()`
- No mutation auto-retries
- The offline read cache covers `profile`, `credits`, `savedPalettes`, and the most recent `history`
  page, and nothing more

---

## Testing Checklist

Two checklists. The first gates the Android release; the second gates nothing today but must hold
before iOS work can be called a platform expansion rather than a second project.

### Android — release gate

- [ ] Every runtime permission is requested at the point of use, with a rationale
- [ ] **Navigation:** hardware back behaves per the §12 contract on every screen, modal, and sheet
- [ ] **Permissions:** camera, photo library, location, and notifications all handle grant, deny, and
      block
- [ ] **Offline handling:** every AI action disables with the standard copy and re-enables on
      reconnect
- [ ] **Error states:** every §6 code has been triggered at least once on a device
- [ ] Screen sizes verified across the matrix; 1.3× text scale does not break a layout
- [ ] **Performance** measured and recorded on the low-end device
- [ ] `usesCleartextTraffic: false`; remote debugging disabled in release
- [ ] Development utilities removed — test buttons, logs, mock data, the API mock switch
- [ ] `npm run scan:secrets` passes against the **production** bundle; git history checked
- [ ] TalkBack pass on the primary flow; reduced-motion path exercised
- [ ] Store listing declares camera, photo library, approximate location, email, and user content
- [ ] Account deletion is reachable in-app and documented in the listing
- [ ] **Production AAB built with EAS, installed on a real device, and tested there** — not only the
      dev build
- [ ] Submitted to the internal testing track and reviewed by real users before public release

---

### iOS — readiness check

Verified now, shipped later. The measure of success: when iOS work begins, the only new code should
be adapter implementations and native configuration.

- [ ] Every adapter has an `.ios.ts` of the same shape; the project compiles for iOS
- [ ] `Info.plist` usage strings present in `app.config.ts` — `NSCameraUsageDescription`,
      `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`, and
      `NSFaceIDUsageDescription` if biometrics ships
- [ ] Safe areas verified at 320pt and with a Dynamic Island; no hardcoded 24dp status bar
- [ ] Swipe-back enabled everywhere except capture and checkout
- [ ] HEIC transcoding path present in `camera.ios.ts`
- [ ] Associated Domains configured for Universal Links
- [ ] `platform/ios/README.md` complete
- [ ] **Appendix D.1 decided before any App Store submission**

---

## Definition of Done

The Android production release is ready:

- The test suite covers pure logic, services, and component states, and passes
- The device matrix has been run and the results recorded
- Performance measured on real low-end hardware
- No secrets in the bundle or git history; no development utilities in the binary
- A production AAB has been installed and tested on a real device
- The store listing is complete and the build is on the internal testing track
- iOS readiness verified — the project compiles for iOS and every adapter has a stub
