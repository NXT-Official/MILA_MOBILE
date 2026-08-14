import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { SelectRow } from "@/components/ui/SelectRow";
import { Sheet } from "@/components/ui/Sheet";
import { VIBES } from "@/constants/vibes";
import { useHaptics } from "@/hooks/use-haptics";
import { useVibeStore } from "@/stores/vibe-store";

/**
 * The occasion, chosen in a bottom sheet rather than inline (§4). Eleven
 * options inline would be a wall on the primary screen, and every dialog on
 * mobile is a sheet.
 */
export function VibePicker() {
  const [open, setOpen] = useState(false);
  const vibe = useVibeStore((s) => s.vibe);
  const setVibe = useVibeStore((s) => s.setVibe);
  const haptics = useHaptics();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Occasion: ${vibe}. Change.`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
        className="h-12 flex-row items-center justify-between rounded-control border border-border bg-surface px-lg dark:border-border/12"
      >
        <Text className="font-body-medium text-base text-ink">{vibe}</Text>
        <Icon name="chevronDown" size="sm" color="muted" />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="What's today?">
        <View accessibilityRole="radiogroup" className="gap-md">
          {VIBES.map((option) => (
            <SelectRow
              key={option}
              title={option}
              selected={option === vibe}
              onPress={() => {
                haptics.selection();
                setVibe(option);
                setOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </>
  );
}
