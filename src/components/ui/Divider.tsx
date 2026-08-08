import { View } from "react-native";

import { cn } from "@/utils/cn";

/** A hairline rule in the warm tan border token — never grey. */
export function Divider({ className }: { className?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn("h-px w-full bg-border dark:bg-border/12", className)}
    />
  );
}
