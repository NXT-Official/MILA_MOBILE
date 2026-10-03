/**
 * The Supabase auth storage adapter for the web bundle.
 *
 * Web is not a Mila platform (Android first, iOS ready — §12); this adapter
 * exists so the web build resolves and the static render can initialize the
 * Supabase client at all. `expo-secure-store` has no web implementation (its
 * native `getValueWithKeyAsync` is undefined, which crashed the export at
 * import time), so sessions live in localStorage instead. During static
 * rendering there is no `window` — the client then simply starts signed out.
 */
export const supabaseStorage = {
  getItem: async (key: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },

  setItem: async (key: string, value: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },

  removeItem: async (key: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};
