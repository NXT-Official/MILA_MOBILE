import type { ReactNode } from "react";
import { View } from "react-native";

import { shadows } from "@/theme/tokens";

/**
 * The warm ground behind the greeting — the web's `.atelier-hero-card`.
 *
 * **Deliberately flat, not a gradient.** This card held an absolutely-filled
 * `react-native-svg` wash, and Android's `SvgView.hitTest()` returns its own
 * view id whenever the SVG has no touchable children — so the decoration
 * claimed every touch in the card and nothing inside it could be pressed. A
 * `pointerEvents="none"` guard fixes that, but it is a guard one careless edit
 * removes, and it has already been lost once in a commit. The dashboard's
 * controls are worth more than a wash that is three near-identical creams deep.
 *
 * If the gradient comes back, it must be `pointerEvents="none"` and it needs a
 * test pinning that, because nothing on screen tells you when it breaks.
 */
export function HeroCard({ children }: { children: ReactNode }) {
  return (
    <View
      // Float-Only Rule: the hero overlaps the page it sits on, so it earns the
      // paper shadow. `elevation` and `shadow*` are different native
      // primitives, which is why shadows stay style objects — §9's exception.
      style={shadows.paper}
      className="gap-lg overflow-hidden rounded-card border border-border bg-surface p-xl dark:border-border/12"
    >
      {children}
    </View>
  );
}
