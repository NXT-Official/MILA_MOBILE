import type { ExpoConfig } from "expo/config";

// Build profile drives the app identity so a preview build can sit beside
// production on the same device. EAS sets APP_VARIANT per profile.
const VARIANT = (process.env.APP_VARIANT ?? "production") as
  | "development"
  | "preview"
  | "production";

const NAME = {
  development: "Mila (dev)",
  preview: "Mila (preview)",
  production: "Mila",
}[VARIANT];

const BUNDLE_ID = {
  development: "com.mila.app.dev",
  preview: "com.mila.app.preview",
  production: "com.mila.app",
}[VARIANT];

const config: ExpoConfig = {
  name: NAME,
  slug: "mila-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  // Deep links, the OAuth callback, the password-reset link, and the Paddle
  // checkout return all address `mila://`. Changing this breaks all four.
  scheme: "mila",
  // New Architecture is the only architecture from SDK 54 — there is no flag.
  userInterfaceStyle: "automatic",

  ios: {
    bundleIdentifier: BUNDLE_ID,
    icon: "./assets/expo.icon",
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    // Written now, while Android is the only target. A missing usage string is
    // an App Store rejection discovered at submission time.
    infoPlist: {
      NSCameraUsageDescription:
        "Mila uses your camera to analyse an outfit and to capture your outfit of the day.",
      NSPhotoLibraryUsageDescription:
        "Mila needs access to your photos so you can analyse an outfit you have already taken.",
      NSLocationWhenInUseUsageDescription:
        "Mila uses your location once to pick the nearest weather hub, so your look suits the day.",
    },
  },

  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: "#f5f0e8",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    // Edge-to-edge is always on from SDK 54 — draw behind the system bars and
    // pad with insets. There is no config flag to set.
    //
    // §10 requires usesCleartextTraffic: false. Android already defaults it to
    // false at targetSdk 28+, so there is nothing to set here; overriding it
    // would need the expo-build-properties plugin.
  },

  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },

  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#f5f0e8", // canvas — light theme
        dark: { backgroundColor: "#110c09" }, // canvas — dark theme
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
      },
    ],
    "expo-secure-store",
    "expo-font",
    [
      // Stills only. `recordAudioAndroid: false` and `microphonePermission:
      // false` keep RECORD_AUDIO out of the manifest entirely — Mila captures
      // no video, and a microphone permission on the Play listing that the app
      // never uses is both a review question and a trust cost.
      //
      // `barcodeScannerEnabled: false` drops the MLKit scanner Mila has no use
      // for, along with its share of the binary.
      "expo-camera",
      {
        cameraPermission:
          "Mila uses your camera to analyse an outfit and to capture your outfit of the day.",
        microphonePermission: false,
        recordAudioAndroid: false,
        barcodeScannerEnabled: false,
      },
    ],
    [
      // Gallery pick. Android uses the system photo picker, which grants access
      // to the single chosen image and needs no READ_MEDIA_IMAGES.
      "expo-image-picker",
      {
        photosPermission:
          "Mila needs access to your photos so you can analyse an outfit you have already taken.",
        cameraPermission:
          "Mila uses your camera to analyse an outfit and to capture your outfit of the day.",
        microphonePermission: false,
      },
    ],
    // The share sheet behind `services/files/` — used by the Phase 08 data
    // export. Its own plugin only registers the module; it adds no permission.
    "expo-sharing",
    [
      // Foreground only. Background location is never requested: Mila reads a
      // position once, to suggest the nearest weather hub, and then forgets it.
      "expo-location",
      {
        locationWhenInUsePermission:
          "Mila uses your location once to pick the nearest weather hub, so your look suits the day.",
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    variant: VARIANT,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
