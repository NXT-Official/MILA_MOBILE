import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "@/theme/tokens";
import { cn } from "@/utils/cn";

type ScreenProps = {
  children: ReactNode;
  /** Wraps the content in a ScrollView. Off for full-bleed screens like capture. */
  scroll?: boolean;
  /** Skip the top inset when a header already consumes it. */
  edges?: { top?: boolean; bottom?: boolean };
  className?: string;
};

/**
 * Every screen's frame. Insets come from useSafeAreaInsets — never a hardcoded
 * value, because gesture navigation, notches, and punch-holes all differ.
 */
export function Screen({
  children,
  scroll = false,
  edges = { top: true, bottom: true },
  className,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: edges.top ? insets.top : 0,
    paddingBottom: edges.bottom ? insets.bottom : 0,
  };

  if (scroll) {
    return (
      <ScrollView
        className={cn("flex-1 bg-canvas", className)}
        contentContainerStyle={{ ...padding, paddingHorizontal: spacing.xl, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={padding} className={cn("flex-1 bg-canvas px-xl", className)}>
      {children}
    </View>
  );
}
