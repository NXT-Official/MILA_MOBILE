import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";

/**
 * One line of the dossier, tappable straight into the step that set it (§3).
 *
 * "Not set" is a real state rather than an empty row: an optional answer she
 * skipped in onboarding should read as an invitation, not as a rendering bug.
 */
export function DossierRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
}) {
  const shown = value?.trim() || "Not set";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${shown}`}
      accessibilityHint="Opens this to change it"
      onPress={onPress}
      className="active:opacity-80 min-h-tap flex-row items-center gap-md px-lg py-md"
    >
      <View className="flex-1 gap-xs">
        <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
          {label}
        </Text>
        <Text className="font-body text-base text-ink">{shown}</Text>
      </View>
      <Icon name="chevronRight" size="sm" color="muted" />
    </Pressable>
  );
}
