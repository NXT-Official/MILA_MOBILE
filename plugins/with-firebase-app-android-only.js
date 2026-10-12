const { withStaticPlugin } = require("expo/config-plugins");

/**
 * Applies `@react-native-firebase/app` without the iOS mods it adds (AppDelegate
 * init, plist copy, Podfile flags). Used while iOS has no Firebase app — see
 * HAS_IOS_FIREBASE in app.config.ts. Props are passed straight through.
 */
module.exports = function withFirebaseAppAndroidOnly(config, props) {
  // Copied: withMod writes into config.mods.ios in place.
  const iosMods = config.mods?.ios && { ...config.mods.ios };
  const next = withStaticPlugin(config, {
    plugin: ["@react-native-firebase/app", props],
  });
  return { ...next, mods: { ...next.mods, ios: iosMods } };
};
