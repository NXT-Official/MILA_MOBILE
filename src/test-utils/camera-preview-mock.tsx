import { forwardRef, useEffect, useImperativeHandle } from "react";
import { View } from "react-native";

import type { CameraHandle, CameraPreviewProps, CapturedPhoto } from "@/services/camera";

export const stubPhoto: CapturedPhoto = {
  uri: "file:///stub-photo.jpg",
  width: 1440,
  height: 1440,
};

/**
 * The native preview, stood in for in jest. It exposes the same imperative
 * `capture()` handle the adapters do and announces readiness the way they do
 * (`onReady` fires once the preview streams, not on mount).
 */
export const CameraPreview = forwardRef<CameraHandle, CameraPreviewProps>((props, ref) => {
  useImperativeHandle(ref, () => ({ capture: async () => stubPhoto }));
  useEffect(() => {
    props.onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once, like the adapter
  }, []);
  return <View testID="camera-preview-stub" />;
});
CameraPreview.displayName = "CameraPreviewStub";
