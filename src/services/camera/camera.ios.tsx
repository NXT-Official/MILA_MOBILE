import { Camera, CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useImperativeHandle, useRef } from "react";
import { Linking, StyleSheet } from "react-native";

import { prepareUpload } from "@/utils/image";

import type {
  CameraHandle,
  CameraPreviewComponent,
  CameraService,
  CapturedPhoto,
  PermissionStatus,
} from "./types";

/** Matches `CAPTURE_QUALITY` in spirit: the encoder pass that follows re-does it. */
const CAPTURE_QUALITY = 0.9;

/**
 * iOS has no re-prompt. `canAskAgain` is still on the response shape (it is
 * generic across `expo-modules-core`), but after a first denial iOS reports
 * `false` for it and never offers a second system prompt — so unlike Android,
 * there is no `"denied"` state worth distinguishing here. Anything that is not
 * granted resolves straight to `"blocked"`, whose only exit is the Settings
 * deep link.
 */
function toStatus(response: { granted: boolean }): PermissionStatus {
  return response.granted ? "granted" : "blocked";
}

/**
 * Full-resolution frames are where memory pressure bites. The capture is
 * downscaled and re-encoded to JPEG **inside the adapter**, so every caller —
 * review preview and upload alike — handles one already-capped file rather
 * than a multi-megabyte original.
 *
 * This is also the HEIC transcode: `prepareUpload` always renders through
 * `expo-image-manipulator` and saves `SaveFormat.JPEG` regardless of the
 * source format, so a HEIC/HEIF capture (iOS's default) comes out the other
 * side as JPEG without any extra branching here — the backend accepts only
 * jpeg/png/webp.
 */
async function normalize(source: {
  uri: string;
  width: number;
  height: number;
}): Promise<CapturedPhoto> {
  return prepareUpload(source);
}

export const camera: CameraService = {
  async getPermission() {
    return toStatus(await Camera.getCameraPermissionsAsync());
  },

  async requestPermission() {
    return toStatus(await Camera.requestCameraPermissionsAsync());
  },

  async openSettings() {
    await Linking.openSettings();
  },

  async pickFromLibrary() {
    // No permission request: iOS's limited photo picker (PHPickerViewController)
    // runs out of process and grants access to only the chosen item, so a
    // photo-library grant over the member's entire camera roll is never needed
    // here — same reasoning as the Android adapter.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      exif: false,
      quality: CAPTURE_QUALITY,
    });

    const asset = result.canceled ? null : result.assets[0];
    return asset ? normalize(asset) : null;
  },
};

/**
 * The live preview. `mute` and `mode="picture"` keep this a stills camera —
 * Mila records no video, so nothing here should reach for a microphone.
 *
 * `mirror` is the one prop this file needs that Android's sibling does not:
 * `CameraView`'s own default only mirrors the front camera on iOS when the
 * prop is set explicitly, so a selfie capture without it comes back reversed
 * relative to what the front screen just showed her.
 */
export const CameraPreview: CameraPreviewComponent = ({ facing, ref, onReady }) => {
  const view = useRef<CameraView>(null);

  useImperativeHandle(
    ref,
    (): CameraHandle => ({
      async capture() {
        const shot = await view.current?.takePictureAsync({
          quality: CAPTURE_QUALITY,
          exif: false,
          skipProcessing: false,
        });
        if (!shot) throw new Error("The camera was not ready.");
        return normalize(shot);
      },
    }),
  );

  return (
    <CameraView
      ref={view}
      // Third-party prop that takes a style object — case 1 of the StyleSheet
      // exceptions. `absoluteFill` because the preview is the screen's ground.
      style={StyleSheet.absoluteFill}
      facing={facing}
      mode="picture"
      mute
      mirror={facing === "front"}
      animateShutter={false}
      onCameraReady={onReady}
    />
  );
};
