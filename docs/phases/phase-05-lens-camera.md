# Phase 05 — Lens Camera

> **Execution plan only.** Rules live in [`AGENTS.md`](../../AGENTS.md). The specification lives in
> [`docs/mobile-architecture.md`](../mobile-architecture.md) — §3 Lens detail, §5 storage, §8 image
> handling, §12 the adapter pattern, §15 Phase 5.

## Goal

Implement camera-based fashion analysis — and give the platform adapter pattern its first real use,
so that adding iOS later means writing an adapter, not touching a screen.

---

## User Outcome

A member can point her camera at an outfit, capture it, and receive an analysis: an overall score,
how the colours sit against her season, a silhouette read, and a verdict. The result is saved to her
history. If she denies the permission or the upload fails, she is told what to do rather than left
staring at a dead screen.

---

## Scope

- Camera permission requested **at the point of use** with a rationale — never at launch
- Live preview → capture → review → upload → analyse → result
- Gallery pick as an alternative to capture
- Image compression before upload
- Result card: score 0–100, colour match, silhouette, verdict
- Saved to history with a "View in History" action
- Retry states at every step, including a failed upload with a good capture
- **The camera and files platform adapters** — contract, Android implementation, iOS stub

---

## Not Included

- Dual capture and posting to the feed → Phase 06
- Garment tagging and "find similar" → Phase 06
- Video capture of any kind
- On-device image analysis. **All analysis is server-side**
- The iOS implementation. Only the stub, so the compiler enforces parity

---

## Implementation Tasks

Ordered. Each task is one commit.

1. **Write the camera contract first.** `services/camera/types.ts` — `requestPermission()`,
   `capture()`, `pickFromLibrary()`, with the `"granted" | "denied" | "blocked"` permission result.
   The contract is written before either implementation so neither one shapes it.
2. **Write `services/camera/index.ts`** — the public API and the only import site. Callers import the
   folder; Metro resolves the platform file.
3. **Implement `camera.android.ts`.** Android distinguishes "denied once" from "don't ask again" —
   `canAskAgain: false` means `"blocked"` and needs a Settings deep link, not another prompt. Cap
   resolution explicitly; OEM cameras vary wildly.
4. **Stub `camera.ios.ts`** with the same shape, throwing `NOT_IMPLEMENTED`, plus the comments that
   record what iOS will need: denial is terminal, and HEIC must be transcoded to JPEG because the
   backend accepts only jpeg/png/webp.
5. **Write the files adapter** the same way — `services/files/` with `saveAndShare()`. Android writes
   to cache and hands off via SAF or a share intent; **never** request legacy
   `WRITE_EXTERNAL_STORAGE`. Stub the iOS file.
6. **Write `utils/image.ts`** using the SDK 57 contextual API — `ImageManipulator.manipulate(uri)` →
   `.resize()` → `renderAsync()` → `saveAsync()`. `manipulateAsync` is deprecated. Target ~1440px at
   q0.85, which turns a 3–6 MB capture into ~200–500 KB.
7. **Write `services/supabase/storage.ts`** — `uploadOutfitImage` to `outfits/${userId}/${uuid}.jpg`.
   Storage RLS requires the first path segment to equal `auth.uid()`.
8. **Write `services/api/analysis.ts`** — `analyzeOutfit` against `POST /api/v1/analysis/outfit`,
   60 s timeout.
9. **Build the permission screen state** — icon, rationale, action. A denial is a normal path, and a
   block deep-links to system settings.
10. **Build the capture screen** (`/lens-capture`, full-screen modal) — live preview, shutter,
    gallery, flip. Full-screen so the camera is not letterboxed by the tab bar.
11. **Build the review state** — retake or analyse.
12. **Build the analysing state** — a skeleton matching the result card, not a spinner.
13. **Build the result card** and its save-to-history path.
14. **Handle the failure matrix** below, end to end.
15. **Verify zero `Platform.OS` references** outside `services/`, and zero direct imports of a
    `.android.ts` / `.ios.ts` file anywhere.

---

## Screens

| #   | Screen       | Route           | Notes                                                         |
| --- | ------------ | --------------- | ------------------------------------------------------------- |
| 7   | **Lens**     | `/(tabs)/lens`  | Replaces the Phase 03 placeholder                             |
| —   | Lens capture | `/lens-capture` | `presentation: "fullScreenModal"`, pushed by the tab listener |
| 10  | History      | `/history`      | Existing — Lens analyses appear alongside saved looks         |

**States, in order:** permission request → live preview → captured preview → analysing → result →
saved.

---

## Components

`CameraPreview` · `ShutterControls` · `CapturedPreview` · `AnalysisSkeleton` · `AnalysisResultCard` ·
`PermissionPrompt` · `SettingsDeepLinkButton`

Reused: `Button`, `Card`, `EmptyState`, `ErrorState`, `Skeleton`, `Icon`, `Screen`.

---

## Services / Integrations

| Service                        | Responsibility                                                    |
| ------------------------------ | ----------------------------------------------------------------- |
| `services/camera/`             | **Platform adapter** — permission, capture, gallery pick          |
| `services/files/`              | **Platform adapter** — save and share (used later by data export) |
| `services/supabase/storage.ts` | Upload to the `outfits` bucket                                    |
| `services/api/analysis.ts`     | `POST /api/v1/analysis/outfit` — 1 credit, 15/hour                |
| `utils/image.ts`               | Resize and compress before upload                                 |

### The adapter shape

```text
services/camera/
  index.ts             public API — the only import site
  types.ts             the contract both platforms satisfy
  camera.android.ts    canAskAgain → "denied" vs "blocked"; OEM resolution cap
  camera.ios.ts        stub — denial is terminal; HEIC → JPEG transcode
```

Write the contract, the Android implementation, and the iOS stub **in the same commit**. A missing
`.ios.ts` hides the gap until an iOS build fails.

### Upload before analyse

`imageUrl` **must** be a Mila public-storage URL. Upload first, then reference. The server rejects
anything else — this is the SSRF defence and it is not negotiable.

---

## Database Requirements

| Table               | Access           | How                                             |
| ------------------- | ---------------- | ----------------------------------------------- |
| `outfits`           | insert, read own | Direct — the analysis is saved as a record      |
| `user_entitlements` | **read only**    | Direct — balance display and verification       |
| `profiles`          | read own         | Direct — body type and season as analysis input |

**Storage:** `outfits` bucket, public, 10 MB limit, `image/jpeg|png|webp`, path
`${userId}/${uuid}.jpg`. The `${userId}/` prefix is enforced by storage RLS.

---

## State Requirements

| Owner          | Holds                                                  | Notes                              |
| -------------- | ------------------------------------------------------ | ---------------------------------- |
| `useState`     | Capture session: permission status, captured URI, step | Dies with the screen — not a store |
| TanStack Query | `credits(userId)` invalidated after the analysis call  | Settle, not success                |
| TanStack Query | History list, invalidated after a save                 | Shared with Phase 04               |

No new Zustand store. A capture that does not survive navigation does not need persistence.

---

## Platform considerations

| Concern           | Android (now)                                                 | iOS (later)                                |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------ |
| Permission denial | `canAskAgain: false` → deep-link to app settings              | Denial is terminal → deep-link to Settings |
| Image format      | JPEG                                                          | **HEIC by default — must transcode**       |
| Resolution        | OEM defaults vary wildly — cap explicitly                     | Consistent                                 |
| Back gesture      | Hardware back during capture → confirm discard                | Swipe-back disabled during capture         |
| Memory            | Full-res capture on a 2 GB device will OOM if not downsampled | Less constrained                           |

Record every permission used in **both** `platform/android/README.md` and
`platform/ios/README.md` — `CAMERA`, `READ_MEDIA_IMAGES`, and the corresponding
`NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`. The iOS strings go into
`app.config.ts` now, even though iOS has not shipped.

---

## Testing Checklist

- [ ] **Permission granted:** capture → analyse → result
- [ ] **Permission denied** once: re-prompt works (Android `canAskAgain: true`)
- [ ] **Permission blocked:** deep-links to system settings, does not re-prompt into a void
- [ ] **Upload error:** a failed upload retains the capture and offers a retry
- [ ] **Successful analysis:** the result card renders and saves to history
- [ ] Gallery pick produces the same result path as a capture
- [ ] Analysis failure refunds the credit — verified against `user_entitlements`
- [ ] Images are compressed before upload (~200–500 KB, not 3–6 MB) — check on a metered connection
- [ ] Rate limit at 16 analyses in an hour shows the countdown
- [ ] Camera opens full-screen, not letterboxed behind the tab bar
- [ ] Android hardware back during capture confirms discard rather than losing the shot
- [ ] **Low-end device (2 GB RAM):** capture + analyse + return without an OOM
- [ ] Zero `Platform.OS` references outside `services/`
- [ ] Zero direct imports of `camera.android.ts` / `camera.ios.ts`
- [ ] The project still type-checks with the iOS stubs present

---

## Definition of Done

The user can analyze images through Lens:

- Capture, upload, analyse, and save work on a real Android device
- **All three permission outcomes** — granted, denied, blocked — are handled distinctly
- The camera and files adapters have Android implementations and iOS stubs that compile
- No screen, feature, or hook knows which operating system it is running on
- Phase 00–04 gates still pass, and §17 of the architecture doc passes
