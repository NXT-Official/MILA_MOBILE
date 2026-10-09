/* global jest */
// AsyncStorage is a native module, so importing a persisted Zustand store in a
// test throws without this. The mock ships with the package.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
