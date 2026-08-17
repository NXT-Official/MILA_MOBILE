# iOS native configuration

**Documentation only. No application code lives in `src/platform/`.**

iOS has not shipped. This file is written **during** Android development, not when iOS begins —
that is the single most effective thing that keeps iOS from becoming a discovery project.

Keep it current as each Android capability lands.

## Info.plist usage strings

These are set in `app.config.ts` — three under `ios.infoPlist` and two supplied by the speech
recogniser's config plugin — before the features that need them exist. A missing usage string is an App Store rejection discovered at submission time.

| Key | Status | Used by |
| --- | --- | --- |
| `NSCameraUsageDescription` | ✅ set | Lens capture, feed post |
| `NSPhotoLibraryUsageDescription` | ✅ set | Gallery pick |
| `NSLocationWhenInUseUsageDescription` | ✅ set | Onboarding location |
| `NSMicrophoneUsageDescription` | ✅ set | Concierge dictation, via the `@jamsch/expo-speech-recognition` plugin. **Not** the media plugins — `microphonePermission: false` still holds on both, because Mila records no video |
| `NSSpeechRecognitionUsageDescription` | ✅ set | Concierge dictation, same plugin. iOS treats speech recognition as a permission separate from the microphone, and needs both |
| `NSFaceIDUsageDescription` | ⬜ add if biometrics ships | Destructive-action re-auth |

`expo-secure-store`'s config plugin supplies its own Face ID string; a separate entry is needed only
if `expo-local-authentication` is added.

Both `expo-camera` and `expo-image-picker` would otherwise add a microphone usage string and request
`RECORD_AUDIO`. Both are disabled in `app.config.ts`; the microphone has exactly one caller, and it is
`services/speech.ts`.

**`SFSpeechRecognizer` differences to expect on the first iOS build:** iOS may route recognition
through Apple's servers unless `requiresOnDeviceRecognition` is set, it enforces a roughly one-minute
ceiling per request where Android does not, and denial is terminal as everywhere else on the platform
— `services/speech.ts` already resolves anything not granted to `"blocked"`. None of this needs a
platform file today; if it ever does, that is the justification for promoting `speech.ts` to an
adapter folder.

## Adapter stubs waiting on iOS

Written in the same commit as their Android counterparts so the compiler enforces parity. Each throws
`NOT_IMPLEMENTED` and carries its own notes in the file.

| Stub | What iOS has to absorb |
| --- | --- |
| `services/camera/camera.ios.tsx` | Denial is terminal — no `canAskAgain`, so anything not `granted` resolves to `"blocked"`. **HEIC is the capture default and the backend accepts only jpeg/png/webp**, so it is transcoded at capture time; `prepareUpload()` already saves `SaveFormat.JPEG`, so calling it is the transcode. Front-camera mirroring uses the `mirror` prop on `CameraView`, not the deprecated per-capture option. |
| `services/files/files.ios.ts` | Writes to `Paths.document` rather than `Paths.cache` — the share sheet can be dismissed and re-presented, and a cached file may be evicted in between. iOS reports share completion natively, so `"cancelled"` there is a real answer rather than the assumption Android forces. |

`services/camera/`'s Android body is otherwise portable: `expo-camera` and `expo-image-picker` are the
same API on both platforms.

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
