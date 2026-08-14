import { View } from "react-native";

import { cn } from "@/utils/cn";

import { Skeleton } from "./Skeleton";

/**
 * The default loading shape for a block of text-like content — three bars of
 * uneven width, because content is not uniform and a stack of identical bars
 * reads as a progress meter.
 *
 * `label` is announced to assistive tech; the bars themselves are hidden from
 * it, so a screen reader hears "Loading today's weather" once instead of three
 * anonymous views.
 */
export function LoadingState({
  label,
  lines = 3,
  className,
}: {
  label: string;
  lines?: number;
  className?: string;
}) {
  const widths = ["w-3/4", "w-full", "w-1/2"];

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      className={cn("gap-sm", className)}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-5", widths[i % widths.length])} />
      ))}
    </View>
  );
}
