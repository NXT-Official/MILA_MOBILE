import type { ReactNode } from "react";
import { View } from "react-native";

import { shadows } from "@/theme/tokens";
import { cn } from "@/utils/cn";

type CardProps = {
  children: ReactNode;
  /**
   * Float-Only Rule: a card casts a shadow only when it overlaps other content.
   * Inside a dense list the border alone carries it.
   */
  floating?: boolean;
  className?: string;
};

export function Card({ children, floating = false, className }: CardProps) {
  return (
    <View
      // elevation vs shadow* are different native primitives, so this is a
      // style object rather than a class — case 1 of the StyleSheet exceptions.
      style={floating ? shadows.paper : undefined}
      // The dark `border` token is deliberately a LIGHT value, consumed at 12%
      // — so dark mode needs the opacity modifier or the rule renders white.
      // A `dark:` variant is allowed here because it lives in a primitive;
      // feature code never sees it.
      className={cn(
        "rounded-card bg-surface border border-border dark:border-border/12 p-xl",
        className,
      )}
    >
      {children}
    </View>
  );
}
