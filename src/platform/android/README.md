# Android native configuration

**Documentation only. No application code lives in `src/platform/`** — no screens, no components,
no features. This file exists so native requirements are written down in one place instead of being
rediscovered from a failed build or a store rejection.

Update it in the same commit as the change it describes.

## Manifest additions

Nothing beyond the Expo defaults yet. Every future addition gets a row here with the reason.

| Addition | Added by | Why |
| -------- | -------- | --- |
| —        | —        | —   |

## Runtime permissions

None requested yet. Each is added by the phase that needs it, requested **at the point of use** with
a rationale — never at launch.

| Permission               | Requested by            | Phase | Status      |
| ------------------------ | ----------------------- | ----- | ----------- |
| `CAMERA`                 | Lens capture, feed post | 05/06 | Not yet     |
| `READ_MEDIA_IMAGES`      | Gallery pick            | 05    | Not yet     |
| `ACCESS_COARSE_LOCATION` | Onboarding location     | 02    | Not yet     |
| `POST_NOTIFICATIONS`     | Daily look reminder     | 10    | Not yet     |

Android distinguishes "denied once" (`canAskAgain: true` — re-prompt) from "don't ask again"
(`canAskAgain: false` — deep-link to system settings). Both paths are handled inside
`services/*/`, never in a screen.

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
