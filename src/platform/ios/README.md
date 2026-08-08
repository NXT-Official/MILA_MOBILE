# iOS native configuration

**Documentation only. No application code lives in `src/platform/`.**

iOS has not shipped. This file is written **during** Android development, not when iOS begins —
that is the single most effective thing that keeps iOS from becoming a discovery project.

Keep it current as each Android capability lands.

## Info.plist usage strings

All three are already set in `app.config.ts` under `ios.infoPlist`, before the features that need
them exist. A missing usage string is an App Store rejection discovered at submission time.

| Key                                    | Status | Used by                     |
| -------------------------------------- | ------ | --------------------------- |
| `NSCameraUsageDescription`             | ✅ set | Lens capture, feed post     |
| `NSPhotoLibraryUsageDescription`       | ✅ set | Gallery pick                |
| `NSLocationWhenInUseUsageDescription`  | ✅ set | Onboarding location         |
| `NSFaceIDUsageDescription`             | ⬜ add if biometrics ships | Destructive-action re-auth |

`expo-secure-store`'s config plugin supplies its own Face ID string; a separate entry is needed only
if `expo-local-authentication` is added.

## Entitlements and capabilities

| Item                              | Status   | Needed for                        |
| --------------------------------- | -------- | --------------------------------- |
| Associated Domains                | ⬜ not yet | Universal Links (§4 deep links)   |
| Push Notifications                | ⬜ not yet | Daily look reminder (Phase 10)    |
| App Store Connect app record      | ⬜ not yet | Submission                        |

## Identity

- **Bundle identifier** — set per build profile in `app.config.ts`: `com.mila.app`,
  `com.mila.app.preview`, `com.mila.app.dev`.
- **Apple Developer team id** — not yet set.
- **Provisioning** — EAS-managed; no certificates in the repo.
- `ios.config.usesNonExemptEncryption: false` is set, which answers the export-compliance prompt
  automatically.

## Divergences the adapters must absorb

These are the reasons `services/*/` exists. Each is handled inside an adapter, never in a screen.

| Concern           | Android                                   | iOS                                        |
| ----------------- | ----------------------------------------- | ------------------------------------------ |
| Permission denial | `canAskAgain: false` → Settings deep link | Denial is terminal → Settings deep link    |
| Image format      | JPEG                                      | **HEIC by default — must transcode**       |
| Back navigation   | Hardware/gesture back                     | Swipe-back only                            |
| Notifications     | Channels (API 26+), runtime permission    | `UNAuthorizationOptions`, no channels      |
| Biometrics        | Fingerprint / face unlock                 | Face ID / Touch ID                         |
| Files             | Scoped storage / SAF                      | Document picker + share sheet              |
| Shadows           | `elevation` only                          | `shadowColor/Opacity/Radius/Offset`        |
| Keyboard          | `adjustResize`                            | `KeyboardAvoidingView behavior="padding"`  |

## Layout checks before shipping iOS

- 320pt width (SE) and Dynamic Island
- Home indicator inset — always `useSafeAreaInsets()`, never a hardcoded 24dp status bar
- Swipe-back enabled everywhere except capture and checkout

## App Store review

**Two blockers, both known now:**

1. **In-app purchase.** Apple generally requires IAP for digital content consumed in-app; the Paddle
   web checkout may be rejected. This is Appendix D.1 in the architecture doc and it blocks Phase 09
   and any submission.
2. **Account deletion must be reachable in the app.** Built in Phase 08.

## iOS-only native modules

None.
