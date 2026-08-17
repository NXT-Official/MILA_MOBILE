# Android native configuration

**Documentation only. No application code lives in `src/platform/`** — no screens, no components,
no features. This file exists so native requirements are written down in one place instead of being
rediscovered from a failed build or a store rejection.

Update it in the same commit as the change it describes.

## Manifest additions

Every addition gets a row here with the reason.

| Addition | Added by | Why |
| --- | --- | --- |
| `CAMERA` | `expo-camera` | Lens live preview and capture (Phase 05) |
| `WRITE_EXTERNAL_STORAGE` / `READ_EXTERNAL_STORAGE`, both `maxSdkVersion="32"` | `expo-image-picker` | Library manifest, legacy devices only. **Mila requests neither at runtime** — see the files adapter below |
| `<queries>` for `IMAGE_CAPTURE` | `expo-image-picker` | Package-visibility declaration required at targetSdk 30+ |
| `RECORD_AUDIO` | `@jamsch/expo-speech-recognition` | Concierge dictation — the **only** microphone use in Mila. See below |
| `<queries>` for `com.google.android.googlequicksearchbox` | `@jamsch/expo-speech-recognition` | Package visibility for the speech service. Without it `SpeechRecognizer` cannot see Google's provider at targetSdk 30+ and dictation silently never starts |

**On `RECORD_AUDIO`:** it is in the manifest for dictation and nothing else. Both `expo-camera` and
`expo-image-picker` would add it too, and both are still configured not to (`recordAudioAndroid:
false`, `microphonePermission: false`) — Mila captures no video, and narrowing the permission to one
caller is what keeps the Play listing answerable. The recogniser returns text; **no audio file is
ever created, stored, or uploaded**, so there is none to leak into a log or a crash report (§7).

**Deliberately absent:**
- **`READ_MEDIA_IMAGES`** — never needed. `expo-image-picker` uses `PickVisualMedia`, the system photo
  picker, which runs out of process and grants access to the single chosen image. A blanket grant over
  the member's whole gallery would buy nothing.
- **MLKit barcode scanning** — `barcodeScannerEnabled: false` on the camera plugin. Mila scans nothing,
  and the scanner is a meaningful share of the binary.

## Runtime permissions

Each is added by the phase that needs it, requested **at the point of use** with a rationale — never
at launch.

| Permission               | Requested by            | Phase | Status                                       |
| ------------------------ | ----------------------- | ----- | -------------------------------------------- |
| `CAMERA`                 | Lens capture, feed post | 05/06 | ✅ `services/camera/` + `PermissionPrompt`   |
| `READ_MEDIA_IMAGES`      | Gallery pick            | 05    | Not needed — system photo picker, see above  |
| `ACCESS_COARSE_LOCATION` | Onboarding location     | 02    | ✅ `services/location.ts`                    |
| `RECORD_AUDIO`           | Concierge dictation     | 07    | ✅ `services/speech.ts` — prompted at the mic button |
| `POST_NOTIFICATIONS`     | Daily look reminder     | 10    | Not yet                                      |

Android distinguishes "denied once" (`canAskAgain: true` — re-prompt) from "don't ask again"
(`canAskAgain: false` — deep-link to system settings). Both paths are handled inside
`services/camera/camera.android.tsx`, which maps them to `"denied"` and `"blocked"`; the screen sees
only those two words. "Not asked yet" collapses into `"denied"` because both are answered by the same
rationale screen and the same button.

## Adapters

| Adapter | Android implementation |
| --- | --- |
| `services/camera/` | `expo-camera` `CameraView` for the live preview, `expo-image-picker` for the gallery. Captures are downscaled to 1440px / q0.85 **inside the adapter** — OEM defaults run from 8 MP to 200 MP, and a full-res bitmap is what kills a 2 GB device |
| `services/speech.ts` | `@jamsch/expo-speech-recognition` over Android's `SpeechRecognizer`. Not an adapter folder: the module already resolves both platforms behind one API, so there is no native behaviour left to branch on |
| `services/files/` | Writes to `Paths.cache` and hands off through a share intent. **Never requests legacy `WRITE_EXTERNAL_STORAGE`** — a share intent passes a `content://` URI the receiving app may read once, which needs no grant at all |

## SDK levels

Managed by Expo SDK 57 defaults. Test on **API 26** (notification channels), **API 33** (runtime
notification permission), and the newest release. Minimum target is whatever Play currently requires.

## Gradle and build

- **Hermes** — the default engine. Minification and obfuscation raise the cost of casual inspection;
  they are not a security control.
- **Edge-to-edge** is always on from SDK 54. Draw behind the system bars and pad with
  `useSafeAreaInsets()`. There is no config flag.
- **`usesCleartextTraffic`** — Android defaults this to `false` at targetSdk 28+, which satisfies the
  §10 requirement. Overriding it would need the `expo-build-properties` plugin; do not add one to
  turn cleartext **on**.
- **`predictiveBackGestureEnabled: false`** — set in `app.config.ts`. The back-button contract in
  §12 assumes classic back behaviour; revisit only alongside that contract.
- **Keystore** — EAS-managed. Never committed, never in the repo, never in an env file.

## Notification channels

None yet. When the daily-look reminder ships (Phase 10), record here: channel id `daily-look`,
its importance, and the accent colour taken from `theme/tokens.ts`.

Channels are required from API 26. `POST_NOTIFICATIONS` is a runtime permission from API 33.

## Deep links

Scheme **`mila`** (`app.config.ts` → `scheme`). Changing it breaks the OAuth callback, the
password-reset link, and the Paddle checkout return simultaneously.

App Links (`assetlinks.json` on the production domain): **not yet configured.** Required before
Universal/App Link paths in §4 work.

## Native modules outside Expo's managed set

None. Adding one requires a written reason here and a matching note in
[`../ios/README.md`](../ios/README.md).
