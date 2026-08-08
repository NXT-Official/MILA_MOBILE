import { useColorScheme } from "nativewind";

import { colors, type ColorToken } from "./tokens";

/**
 * Resolves a design token to the active theme's value.
 *
 * Needed only where a className cannot reach: lucide SVG primitives, navigator
 * options, and bottom-sheet props. Everything else styles with utility classes.
 */
export function useThemeColor(token: ColorToken): string {
  const { colorScheme } = useColorScheme();
  return colors[colorScheme ?? "light"][token];
}

export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  return colors[colorScheme ?? "light"];
}

export { colors, type ColorToken };
