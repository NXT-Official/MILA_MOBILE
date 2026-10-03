import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

/**
 * AsyncStorage's web shim reads `window.localStorage`, which does not exist
 * during the web export's static render (plain Node). Give zustand's persist
 * middleware a no-op store there — nothing to rehydrate, nothing to write —
 * so the module graph can be evaluated server-side. On the shipped platforms
 * (Android, iOS) and in real browsers this returns AsyncStorage unchanged.
 */
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export function persistStorage(): StateStorage {
  return typeof window === "undefined" ? noopStorage : AsyncStorage;
}
