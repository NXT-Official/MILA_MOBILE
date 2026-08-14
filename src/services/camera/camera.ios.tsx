import type { CameraPreviewComponent, CameraService } from "./types";
import { NOT_IMPLEMENTED } from "./types";

/**
 * iOS stub. Written in the same commit as the Android implementation so the
 * compiler enforces parity from day one — a *missing* file hides the gap until
 * an iOS build fails, which is the expensive way to discover it (§12).
 *
 * What iOS will need when it is implemented, recorded here rather than
 * rediscovered:
 *
 * 1. **Denial is terminal.** There is no `canAskAgain`. A `status` that is not
 *    `granted` resolves straight to `"blocked"` — the only exit is the Settings
 *    deep link, and `Linking.openSettings()` already covers it.
 * 2. **HEIC must be transcoded.** It is the iOS capture default and the backend
 *    accepts only jpeg/png/webp, so the image is converted at capture time, not
 *    at the upload boundary. `prepareUpload()` already saves `SaveFormat.JPEG`,
 *    so calling it — exactly as the Android adapter does — is the transcode.
 * 3. **Front-camera mirroring.** `CameraView` needs the `mirror` prop rather
 *    than the deprecated per-capture `mirror` option.
 * 4. **`NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`** are
 *    already set in `app.config.ts`; no plist work remains.
 *
 * The Android body is otherwise portable — `expo-camera` and
 * `expo-image-picker` are the same API on both platforms.
 */
function notImplemented(): never {
  throw new Error(NOT_IMPLEMENTED);
}

export const camera: CameraService = {
  getPermission: notImplemented,
  requestPermission: notImplemented,
  openSettings: notImplemented,
  pickFromLibrary: notImplemented,
};

export const CameraPreview: CameraPreviewComponent = () => notImplemented();
