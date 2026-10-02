import { NOT_IMPLEMENTED } from "./types";

import type { CameraPreviewComponent, CameraService } from "./types";

/**
 * Web is not a Mila platform (Android first, iOS ready — §12). This adapter
 * exists only so a web build resolves `@/services/camera` instead of failing
 * on the missing platform file; every service method throws
 * `NOT_IMPLEMENTED`, and the preview renders nothing rather than breaking a
 * render on the one platform the product does not ship.
 */
function notImplemented(): never {
  throw new Error(NOT_IMPLEMENTED);
}

export const camera: CameraService = {
  getPermission: () => notImplemented(),
  requestPermission: () => notImplemented(),
  openSettings: () => notImplemented(),
  pickFromLibrary: () => notImplemented(),
};

export const CameraPreview: CameraPreviewComponent = () => null;
