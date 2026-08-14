import type { ReactNode, Ref } from "react";

/**
 * The camera contract, written before either implementation so that neither
 * one shapes it (§12).
 *
 * Everything a platform does differently lives behind this file: permission
 * semantics, the capture pipeline, and the image format that comes out of it.
 * A screen importing `@/services/camera` cannot tell which OS it is on.
 */

export type Facing = "front" | "back";

/**
 * Three outcomes, not two.
 *
 * Android separates "denied once" from "don't ask again": the first re-prompts,
 * the second must deep-link to system settings because a second prompt would
 * never appear and the member would tap into a void. `"denied"` also covers
 * "not asked yet" — both are answered by the same rationale screen and the same
 * button, so a fourth state would buy nothing.
 *
 * iOS has no re-prompt at all, so a denial there resolves straight to
 * `"blocked"`.
 */
export type PermissionStatus = "granted" | "denied" | "blocked";

/** Already capped and transcoded by the adapter — see `utils/image.ts`. */
export type CapturedPhoto = { uri: string; width: number; height: number };

/** The imperative handle on a mounted `CameraPreview`. */
export type CameraHandle = { capture(): Promise<CapturedPhoto> };

export type CameraPreviewProps = {
  facing: Facing;
  ref?: Ref<CameraHandle>;
  /** Fired once the native preview is actually streaming, not on mount. */
  onReady?: () => void;
};

/**
 * The live preview is native UI, which is exactly why it ships with the
 * adapter rather than sitting in `features/`. A feature that imported
 * `CameraView` directly would be talking to a platform API — the thing §5
 * forbids — and would need editing again when iOS lands.
 */
export type CameraPreviewComponent = (props: CameraPreviewProps) => ReactNode;

export interface CameraService {
  /** Reads the current status. **Never prompts** — safe to call on mount. */
  getPermission(): Promise<PermissionStatus>;
  /** Prompts. Called from the rationale screen, never at launch (§10). */
  requestPermission(): Promise<PermissionStatus>;
  /** Deep-links to this app's settings page — the only way out of `"blocked"`. */
  openSettings(): Promise<void>;
  /** Null when the member backed out of the picker. Cancelling is not an error. */
  pickFromLibrary(): Promise<CapturedPhoto | null>;
}

/** Thrown by an adapter method that a platform has not implemented yet. */
export const NOT_IMPLEMENTED = "NOT_IMPLEMENTED";
