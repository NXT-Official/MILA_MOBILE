import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { shadows } from "@/theme/tokens";
import { useThemeColors } from "@/theme/tailwind";

/**
 * The warm wash behind the greeting — the web's `.atelier-hero-card`.
 *
 * Every stop is an existing token, so the card cannot drift off-palette: it
 * opens on the champagne veil, passes through porcelain, and lands on the page
 * colour, which is what makes the card dissolve into the canvas at its foot
 * rather than ending on a hard edge. Reading the tokens through
 * `useThemeColors()` means both themes fall out of the same three names — and
 * this card only *reads* the scheme; applying it belongs to the root layout.
 *
 * Drawn with `react-native-svg` (already a dependency) rather than adding
 * `expo-linear-gradient` for one surface.
 */
export function HeroCard({ children }: { children: ReactNode }) {
  const colors = useThemeColors();

  return (
    <View
      // Float-Only Rule: the hero overlaps the page it sits on, so it earns the
      // paper shadow. `elevation` and `shadow*` are different native
      // primitives, so shadows stay style objects — §9's third exception.
      style={shadows.paper}
      className="overflow-hidden rounded-card border border-border dark:border-border/12"
    >
      {/* `pointerEvents="none"` is load-bearing, not tidiness: Android's
          `SvgView.hitTest()` returns its OWN view id whenever the SVG has no
          touchable children, so an absolutely-filled gradient claims every
          touch in the card and nothing inside it can be pressed. The guard sits
          on the decoration, so every child stays live — present and future. */}
      <View testID="hero-gradient" pointerEvents="none" className="absolute inset-0">
        {/* 145deg in the web's CSS — mostly downward, drifting right. */}
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="hero" x1="0" y1="0" x2="0.7" y2="1">
              <Stop offset="0" stopColor={colors.accentSoft} />
              <Stop offset="0.6" stopColor={colors.surface} />
              <Stop offset="1" stopColor={colors.canvas} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero)" />
        </Svg>
      </View>

      <View className="gap-lg p-xl">{children}</View>
    </View>
  );
}
