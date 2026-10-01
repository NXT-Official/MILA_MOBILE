import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { Icon } from "@/components/ui/Icon";
import { useOutfits } from "@/hooks/use-outfits";
import { normalizeAnalysisResult, outfitTitle } from "@/lib/outfit-history";
import type { ConciergeLook } from "@/stores/concierge-store";
import { radii, spacing } from "@/theme/tokens";

/**
 * "Ask about a look from your archive" — the web's collapsible strip above the
 * composer. Tapping a thumb anchors that look, so a member can start a thread
 * about something she saved last week without going back through History.
 *
 * The rows come from `useOutfits`, the query History already owns; the web runs
 * its own 10-row query, but there is one source of truth for her own looks.
 * Collapsed by default: it sits directly above the composer, and the web's
 * persisted open state has no meaning on a phone.
 */
export function ArchivePicker({ onSelect }: { onSelect: (look: ConciergeLook) => void }) {
  const [open, setOpen] = useState(false);
  const { data: outfits, isPending } = useOutfits();

  const recent = (outfits ?? []).slice(0, 10);

  // Nothing saved yet: the strip would be a control with nothing behind it.
  if (isPending || recent.length === 0) return null;

  return (
    <View className="gap-sm">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Ask about a look from your archive"
        onPress={() => setOpen((value) => !value)}
        hitSlop={8}
        className="active:opacity-60 min-h-tap flex-row items-center justify-between px-xl"
      >
        <Text className="font-body text-micro tracking-label uppercase text-muted">
          Ask about a look from your archive
        </Text>
        <Icon name={open ? "forward" : "back"} size="xs" color="muted" />
      </Pressable>

      {open ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Third-party prop that takes a style object — case 1 of the exceptions.
          contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.xl }}
        >
          {recent.map((outfit) => {
            const entry = normalizeAnalysisResult(outfit.analysis_result);
            const title = outfitTitle(entry);

            return (
              <Pressable
                key={outfit.id}
                accessibilityRole="button"
                accessibilityLabel={`Ask about ${title}`}
                onPress={() =>
                  onSelect({ id: outfit.id, imageUrl: outfit.image_url, headline: title })
                }
                className="active:opacity-80 w-16 gap-xs"
              >
                <ImageWithFallback
                  uri={outfit.image_url}
                  recyclingKey={outfit.id}
                  accessibilityLabel={title}
                  // Case 1 of the StyleSheet exceptions. Sized from tokens at
                  // the §11 card ratio rather than a pair of chosen pixels.
                  style={{ width: spacing["3xl"], aspectRatio: 3 / 4, borderRadius: radii.control }}
                />
                <Text numberOfLines={1} className="font-body text-micro text-muted">
                  {title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
