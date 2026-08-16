import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Directive } from "@/constants/style-profile";

/**
 * One of Mila's styling notes — the named things to reach for, plus the caveat.
 *
 * The web renders each term behind a popover because its two-column card has no
 * room for the definitions. A phone is one column with vertical room to spare,
 * so the definition sits inline: the member who does not know what a peplum is
 * is exactly the member who should not have to discover a tap target to find
 * out.
 */
export function StylingNoteCard({
  title,
  directive,
  rationale,
  fallback,
  action,
}: {
  title: string;
  directive?: Directive;
  /**
   * The dossier input this was derived from — stated so the advice connects.
   * Omit `value` when the input is one the hero already names (the season).
   */
  rationale?: { label: string; value?: string | null };
  /** Shown instead of the directive when the input it needs is missing. */
  fallback?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Card className="gap-md">
      <Text accessibilityRole="header" className="font-display text-lg text-ink">
        {title}
      </Text>

      {directive && rationale ? (
        <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
          {rationale.value
            ? `Because your ${rationale.label} is ${rationale.value}`
            : `Because of your ${rationale.label}`}
        </Text>
      ) : null}

      {directive ? (
        <>
          <View className="gap-md">
            {directive.items.map((item) => (
              <View key={item.term} className="flex-row gap-md">
                {item.hex ? (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    // Case 1 of the StyleSheet exceptions: the colour is data.
                    style={{ backgroundColor: item.hex }}
                    className="mt-xs h-lg w-lg rounded-pill border border-border dark:border-border/12"
                  />
                ) : null}
                <View className="flex-1 gap-xs">
                  <Text className="font-body-semibold text-sm text-ink">{item.term}</Text>
                  <Text className="font-body text-sm text-body">{item.definition}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text className="font-body text-sm text-muted">{directive.note}</Text>
        </>
      ) : (
        <Text className="font-body text-base text-body">{fallback}</Text>
      )}

      {action ? <Button label={action.label} variant="ghost" onPress={action.onPress} /> : null}
    </Card>
  );
}
