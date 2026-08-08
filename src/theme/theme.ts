import { useColorScheme } from "nativewind";
import { useEffect } from "react";

import { useThemeStore } from "@/stores/theme-store";

/**
 * Applies the stored preference to NativeWind, which toggles the `dark` class
 * and re-resolves every CSS variable. No component re-styles itself and no
 * `dark:` prefix is involved anywhere in feature code.
 *
 * "system" follows the OS through NativeWind's own Appearance subscription.
 */
export function useAppliedTheme() {
  const preference = useThemeStore((s) => s.preference);
  const { setColorScheme, colorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);

  return { preference, resolved: colorScheme ?? "light" } as const;
}
