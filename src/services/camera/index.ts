export type {
  CameraHandle,
  CameraPreviewComponent,
  CameraPreviewProps,
  CameraService,
  CapturedPhoto,
  Facing,
  PermissionStatus,
} from "./types";
export { NOT_IMPLEMENTED } from "./types";

// The only import site. Metro resolves `./camera` to camera.android.tsx or
// camera.ios.tsx; callers import this folder and never a platform file.
export { camera, CameraPreview } from "./camera";
