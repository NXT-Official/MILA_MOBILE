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
 * `canAskAgain: false` is Android's "don't ask again", and it is the whole
 * reason this type has three values. A second `requestPermission()` in that
 * state resolves instantly with the same denial and shows the member nothing —
 * so it maps to `"blocked"`, whose only exit is the settings deep link.
 *
 * "Undetermined" collapses into `"denied"` deliberately: both are answered by
 * the rationale screen and its one button.
 */
function toStatus(response: { granted: boolean; canAskAgain: boolean }): PermissionStatus {
  if (response.granted) return "granted";
  return response.canAskAgain ? "denied" : "blocked";
}

/**
 * Full-resolution frames are where a 2 GB device dies. The capture is downscaled
 * and re-encoded to JPEG **inside the adapter**, so the bitmap is only briefly
 * at sensor size and every caller — review preview and upload alike — handles
 * one already-capped file rather than a 3–6 MB original.
 *
 * This is also the explicit resolution cap Android needs: OEM defaults range
 * from 8 MP to 200 MP and `takePictureAsync` honours whichever the device picked.
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
    // No permission request: Android's system photo picker runs out of process
    // and grants access to the single chosen item, so `READ_MEDIA_IMAGES` — a
    // grant over the member's entire gallery — is never needed here.
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
          // Orientation correction is worth the extra frames: several Sony and
          // Samsung sensors hand back a 90°-rotated image otherwise, and the
          // review screen would show the outfit sideways.
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
      animateShutter={false}
      onCameraReady={onReady}
    />
  );
};
