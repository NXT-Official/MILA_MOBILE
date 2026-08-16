import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colors, shadows } from "@/theme/tokens";
import { useAppliedTheme } from "@/theme/theme";

/**
 * The warm wash behind the greeting — the web's `.atelier-hero-card`.
 *
 * Every stop is an existing token, so the card cannot drift off-palette: it
 * opens on the champagne veil, passes through porcelain, and lands on the page
 * colour, which is what makes the card dissolve into the canvas at its foot
 * rather than ending on a hard edge.
 *
 * Drawn with `react-native-svg` (already a dependency) rather than adding
 * `expo-linear-gradient` for one surface.
 */
const STOPS = {
  light: [colors.light.accentSoft, colors.light.surface, colors.light.canvas],
  dark: [colors.dark.surfaceAlt, colors.dark.surface, colors.dark.canvas],
} as const;

export function HeroCard({ children }: { children: ReactNode }) {
  const { resolved } = useAppliedTheme();
  const [start, middle, end] = STOPS[resolved === "dark" ? "dark" : "light"];

  return (
    <View
      // Float-Only Rule: the hero overlaps the page it sits on, so it earns the
      // paper shadow. Case 1 of the StyleSheet exceptions.
      style={shadows.paper}
      className="overflow-hidden rounded-card border border-border dark:border-border/12"
    >
      {/* 145deg in the web's CSS — mostly downward, drifting right. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="hero" x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={start} />
            <Stop offset="0.6" stopColor={middle} />
            <Stop offset="1" stopColor={end} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero)" />
      </Svg>

      <View className="gap-lg p-xl">{children}</View>
    </View>
  );
}
