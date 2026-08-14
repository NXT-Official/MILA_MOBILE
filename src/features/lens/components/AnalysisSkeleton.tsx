import { View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors `AnalysisResultCard` — a score figure, then three labelled blocks —
 * so the layout does not jump when the verdict lands.
 *
 * A skeleton, never a spinner (§10). At a 60s budget a spinner says only
 * "wait"; this says what is arriving, which is the difference between a member
 * holding on and a member leaving.
 */
export function AnalysisSkeleton() {
  return (
    <Card className="gap-xl">
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Mila is reading your outfit"
        accessibilityState={{ busy: true }}
        className="flex-row items-baseline gap-md"
      >
        <Skeleton className="h-3xl w-2xl" />
        <Skeleton className="h-4 w-1/4" />
      </View>

      {[0, 1, 2].map((section) => (
        <View key={section} className="gap-sm">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </View>
      ))}
    </Card>
  );
}
