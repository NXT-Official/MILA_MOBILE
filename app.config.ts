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
    // Store purchases need a rebuilt native app; Expo Go does not load this
    // module. Product setup and server receipt verification are tracked in §9.
    "expo-iap",
    [
      // Dictation in the Concierge composer, behind `services/speech.ts`.
      //
      // This is the one thing in Mila that holds a microphone, and it is the
      // reason RECORD_AUDIO is back in the manifest after `expo-camera` and
      // `expo-image-picker` were both configured to keep it out. It is
      // requested at the mic button, never at launch, and the recogniser is
      // stopped the moment she taps it again.
      //
      // The plugin also declares package visibility for the speech service —
      // without that `<queries>` entry Android's SpeechRecognizer cannot see
      // Google's provider at targetSdk 30+ and dictation silently never starts.
      "@jamsch/expo-speech-recognition",
      {
        microphonePermission:
          "Mila uses your microphone only while you are dictating a message to her.",
        speechRecognitionPermission:
          "Mila turns what you say into the text of your message. Nothing is recorded or kept.",
      },
    ],
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
    [
      // Uploads debug symbols at build time so a native stack trace resolves
      // to real source rather than addresses — `Sentry.init` itself lives in
      // `services/crash-reporting.ts` and is a no-op without a DSN.
      //
      // The upload task does NOT skip itself when org/project are missing: it
      // runs and fails the release build ("An organization ID or slug is
      // required"). Until the client's Sentry project exists, every build
      // profile therefore sets `SENTRY_DISABLE_AUTO_UPLOAD=true` (see
      // eas.json); when the project is created, remove that flag and set
      // SENTRY_AUTH_TOKEN alongside org/project — RELEASE-SETUP.md §4.
      "@sentry/react-native/expo",
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    variant: VARIANT,
    // Linked to the EAS project under the kurtgav account (`eas init`, Sep 23).
    // The env override stays for anyone building against a different project.
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "8ee3d05d-b5a3-4670-8096-5eac1ac4e834" },
  },
};

export default config;
