const { existsSync } = require("node:fs");
const { join } = require("node:path");

// iOS Firebase stays out of autolinking until `GoogleService-Info.plist` exists
// at the repo root — the same switch as HAS_IOS_FIREBASE in app.config.ts.
// Without the plist the Firebase pods would install with no app to configure.
const hasIosFirebase = existsSync(join(__dirname, "GoogleService-Info.plist"));
const androidOnly = { platforms: { ios: null } };

module.exports = {
  dependencies: hasIosFirebase
    ? {}
    : {
        "@react-native-firebase/app": androidOnly,
        "@react-native-firebase/crashlytics": androidOnly,
      },
};
