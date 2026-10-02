import type { FilesService } from "./types";

/**
 * Web is not a Mila platform (Android first, iOS ready — §12). This adapter
 * exists only so a web build resolves `@/services/files` instead of failing
 * on the missing platform file; every method throws the same
 * `NOT_IMPLEMENTED` marker the camera contract defines for platform code the
 * product does not ship.
 */
const NOT_IMPLEMENTED = "NOT_IMPLEMENTED";

function notImplemented(): never {
  throw new Error(NOT_IMPLEMENTED);
}

export const files: FilesService = {
  saveAndShare: () => notImplemented(),
  saveAndShareImage: () => notImplemented(),
  saveAndShareRemoteImage: () => notImplemented(),
};
