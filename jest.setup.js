/* global jest */
// AsyncStorage is a native module, so importing a persisted Zustand store in a
// test throws without this. The mock ships with the package.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Firebase's native modules are absent under jest, and the JS entry point
// resolves them on import — without this every suite that reaches
// `services/observability` (directly or through the root layout) fails on the
// import rather than on anything it tests. The double matches the modular
// surface the Crashlytics adapter calls (v26 has no default export).
jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  getCrashlytics: jest.fn(() => ({ __handle: "crashlytics" })),
  recordError: jest.fn(),
  log: jest.fn(),
  setAttribute: jest.fn(() => Promise.resolve(null)),
  setUserId: jest.fn(() => Promise.resolve(null)),
  setCrashlyticsCollectionEnabled: jest.fn(() => Promise.resolve(null)),
}));

jest.mock("@react-native-firebase/app", () => ({
  __esModule: true,
  getApp: jest.fn(() => ({ name: "[DEFAULT]" })),
}));
