import { Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import type { LensAnalysisRecord } from "@/types/look";

/**
 * The Lens verdict: a score, then the two reads that produced it, then the
 * sentence a member actually repeats to herself.
 *
 * **The score carries no hue.** A red 42 and a green 88 would encode state in
 * colour alone, which §10 forbids outright — the number and the word "Score"
 * say everything the colour would, and they survive both a monochrome display
 * and a member who cannot separate the two.
 */
export function AnalysisResultCard({ analysis }: { analysis: LensAnalysisRecord }) {
  return (
    <Card className="gap-xl">
      <View className="flex-row items-baseline gap-md">
        {/* Playfair for the figure: this is a pulled numeral, the editorial
            equivalent of a headline, not a metric on a dashboard. */}
        <Text className="font-display text-display tracking-display text-ink">
          {analysis.overall_score}
        </Text>
        <Text className="font-body text-sm text-muted">out of 100</Text>
      </View>

      {analysisSections(analysis).map((section) => (
        <View key={section.title} className="gap-sm">
          <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
            {section.title}
          </Text>
          <Text className="font-body text-base text-body">{section.body}</Text>
        </View>
      ))}
    </Card>
  );
}

/**
 * Exported so `AnalysisSkeleton` mirrors the real layout rather than guessing
 * at it — the two drift apart the moment they each hold their own list.
 * Empties are dropped: a model that returned no silhouette read should show
 * nothing, not an empty heading.
 */
export function analysisSections(analysis: LensAnalysisRecord): { title: string; body: string }[] {
  return [
    { title: "Colour", body: analysis.color_match },
    { title: "Silhouette", body: analysis.silhouette },
    { title: "Verdict", body: analysis.verdict },
  ].filter((section) => section.body.trim().length > 0);
}
