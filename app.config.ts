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
      // Stills only. No video capture: `recordAudioAndroid: false` (Android
      // adds RECORD_AUDIO only when it is true) and `microphonePermission:
      // false` (iOS). Dictation's own RECORD_AUDIO comes from the speech
      // plugin below — nothing in this file may emit a `tools:node` remove
      // for it.
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
      //
      // `microphonePermission` must NOT be `false` here: the plugin answers
      // that with a `tools:node="remove"` entry, and the Android manifest
      // merger applies it last — stripping RECORD_AUDIO even though the
      // speech plugin below adds it, which kills Concierge dictation in every
      // installed build (QA F-MM-001, verified against the packaged release
      // manifest). The usage string keeps the permission declared.
      "expo-image-picker",
      {
        photosPermission:
          "Mila needs access to your photos so you can analyse an outfit you have already taken.",
        cameraPermission:
          "Mila uses your camera to analyse an outfit and to capture your outfit of the day.",
        microphonePermission:
          "Mila uses your microphone only while you are dictating a message to her.",
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
      // This plugin OWNS the RECORD_AUDIO permission. Nothing above may emit
      // a `tools:node="remove"` for it (see the image-picker note): the
      // manifest merger's removal wins over this add and dictation dies in
      // the installed build. It is requested at the mic button, never at
      // launch, and the recogniser is stopped the moment she taps it again.
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
    // The team's EAS project (`@naaxtechs-team/mila-mobile`) — the builds the
    // dev team installs from. The env override stays for anyone building
    // against a different project; note that EAS Build re-evaluates this file
    // without your shell env, so a different project must also be set in
    // eas.json's profile env (or an EAS environment variable) or the build
    // fails with EAS_BUILD_PROJECT_ID_MISMATCH.
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "98d444fe-f321-450f-bb61-88360ebf17f2" },
  },
};

export default config;
