import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { env } from "@/constants/env";

import type { Database } from "./types";

/**
 * Expo enforces no size limit, but the platform can reject large values —
 * historically iOS refused anything above ~2048 bytes. A Supabase session with
 * a large JWT exceeds that, so chunk it rather than trust the platform.
 */
const CHUNK_SIZE = 1800;
const CHUNK_PREFIX = "__chunks__:";

const SecureStoreAdapter = {
  getItem: async (key: string) => {
    const head = await SecureStore.getItemAsync(key);
    if (head === null || !head.startsWith(CHUNK_PREFIX)) return head;

    const count = Number(head.slice(CHUNK_PREFIX.length));
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
    );
    // A partial write leaves an unusable session; treat it as absent so the app
    // re-authenticates instead of failing on a truncated token.
    return parts.every((p) => p !== null) ? parts.join("") : null;
  },

  setItem: async (key: string, value: string) => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}.${i}`, c)));
    await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${chunks.length}`);
  },

  removeItem: async (key: string) => {
    const head = await SecureStore.getItemAsync(key);
    if (head?.startsWith(CHUNK_PREFIX)) {
      const count = Number(head.slice(CHUNK_PREFIX.length));
      await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
      );
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: SecureStoreAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // no browser URL to parse
    },
  },
);

// Refresh only while foregrounded — a background timer drains battery and
// Android will kill it anyway.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
