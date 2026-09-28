import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import type { Directive, DirectiveItem } from "@/constants/style-profile";

import { ItemIllustration } from "./ItemIllustration";

/**
 * One of Mila's styling notes — the named things to reach for, plus the caveat.
 *
 * The web renders each term behind a popover because its two-column card has no
 * room for the definitions. A phone is one column with vertical room to spare,
 * so the definition sits inline: the member who does not know what a peplum is
 * is exactly the member who should not have to discover a tap target to find
 * out.
 *
 * The tap still earns its keep — every row opens the same item at detail size,
 * the drawing (or the colour, full width) with its full definition. That is the
 * "example image" the styling notes ask for, without shipping photography.
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
  /** The item whose detail sheet is open. One sheet per card, by identity. */
  const [openItem, setOpenItem] = useState<DirectiveItem | null>(null);

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
              <Pressable
                key={item.term}
                accessibilityRole="button"
                accessibilityLabel={`${item.term}. ${item.definition}`}
                accessibilityHint="Opens this piece at detail size"
                onPress={() => setOpenItem(item)}
                className="active:opacity-80 min-h-tap flex-row items-center gap-md rounded-control"
              >
                {/* A fixed-width slot so every row's text starts on the same
                    line, whichever visual sits in it. */}
                <View className="w-3xl items-center">
                  {item.hex ? (
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      // Case 1 of the StyleSheet exceptions: the colour is data.
                      style={{ backgroundColor: item.hex }}
                      className="h-xl w-xl rounded-pill border border-border dark:border-border/12"
                    />
                  ) : (
                    <ItemIllustration term={item.term} />
                  )}
                </View>
                <View className="flex-1 gap-xs">
                  <Text className="font-body-semibold text-sm text-ink">{item.term}</Text>
                  <Text className="font-body text-sm text-body">{item.definition}</Text>
                </View>
                <Icon name="chevronRight" size="sm" color="muted" />
              </Pressable>
            ))}
          </View>

          <Text className="font-body text-sm text-muted">{directive.note}</Text>
        </>
      ) : (
        <Text className="font-body text-base text-body">{fallback}</Text>
      )}

      {action ? <Button label={action.label} variant="ghost" onPress={action.onPress} /> : null}

      <Sheet
        visible={openItem !== null}
        onClose={() => setOpenItem(null)}
        title={openItem?.term ?? ""}
        height="55%"
      >
        {openItem ? (
          <View className="gap-lg">
            <View className="items-center rounded-card border border-border bg-surface-alt px-lg py-xl dark:border-border/12">
              {openItem.hex ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  // Case 1 again: resolved palette data, never styling.
                  style={{ backgroundColor: openItem.hex }}
                  className="h-3xl w-full rounded-control border border-border dark:border-border/12"
                />
              ) : (
                <ItemIllustration term={openItem.term} size="lg" />
              )}
            </View>
            <Text className="font-body text-base text-body">{openItem.definition}</Text>
          </View>
        ) : null}
      </Sheet>
    </Card>
  );
}
