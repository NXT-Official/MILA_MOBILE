import { useThemeStore, type ThemePreference } from "@/stores/theme-store";

/**
 * The theme preference, as a pair.
 *
 * A hook over the store rather than components reaching into it directly, so
 * the settings screen and any future surface read one shape — and so the
 * three-value contract (`light | dark | system`) has one place to change.
 */
export function useTheme(): {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
} {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return { preference, setPreference };
}

export const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Always the paper-cream ground." },
  { value: "dark", label: "Dark", hint: "Always the ink ground." },
  { value: "system", label: "System", hint: "Follows your device setting." },
];
