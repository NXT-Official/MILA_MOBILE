import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { SelectRow } from "@/components/ui/SelectRow";
import { Sheet } from "@/components/ui/Sheet";
import { VIBES } from "@/constants/vibes";
import { useHaptics } from "@/hooks/use-haptics";
import { useVibeStore } from "@/stores/vibe-store";

/**
 * The trigger only. Its sheet is `VibeSheet`, mounted by the screen at the root
 * rather than here — a bottom sheet nested inside the hero card sits under an
 * `overflow-hidden` elevated container, which is a standing invitation to
 * present something the member never sees. `HubSheet` is mounted the same way,
 * for the same reason.
 */
export function VibePicker({ onPress }: { onPress: () => void }) {
  const vibe = useVibeStore((s) => s.vibe);

  return (
    <View className="gap-sm">
      <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
        Today&apos;s mood
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Occasion: ${vibe}. Change.`}
        onPress={onPress}
        className="active:opacity-90 min-h-tap flex-row items-center justify-between rounded-pill border border-border bg-surface px-lg dark:border-border/12"
      >
        <Text className="font-body text-base text-ink">{vibe}</Text>
        <Icon name="chevronDown" size="sm" color="muted" />
      </Pressable>
    </View>
  );
}

/**
 * The occasion, chosen in a bottom sheet rather than inline (§4). Eleven
 * options inline would be a wall on the primary screen, and every dialog on
 * mobile is a sheet.
 */
export function VibeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const vibe = useVibeStore((s) => s.vibe);
  const setVibe = useVibeStore((s) => s.setVibe);
  const haptics = useHaptics();

  return (
    <Sheet visible={visible} onClose={onClose} title="What's today?">
      <View accessibilityRole="radiogroup" className="gap-md">
        {VIBES.map((option) => (
          <SelectRow
            key={option}
            title={option}
            selected={option === vibe}
            onPress={() => {
              haptics.selection();
              setVibe(option);
              onClose();
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
