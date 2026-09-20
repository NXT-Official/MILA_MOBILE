import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";

export function CreditsPill({
  balance,
  loading,
  onPress,
}: {
  balance: number | null;
  loading: boolean;
  onPress: () => void;
}) {
  if (loading) {
    return <Skeleton className="h-9 w-18 rounded-pill" />;
  }

  const known = balance !== null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        known
          ? `${balance} AI credits. View membership plans and credits.`
          : "Credits unavailable. View membership plans and credits."
      }
      onPress={onPress}
      className="min-h-tap justify-center active:opacity-80"
    >
      <View
        className="
          h-9
          flex-row
          items-center
          justify-center
          gap-1.5
          rounded-pill
          border
          border-border/60
          bg-surface/40
          px-3
          dark:border-white/10
          dark:bg-white/5
        "
      >
        <Icon name="coins" size="xs" color="accent" />

        <Text
          className="
            font-body-semibold
            text-micro
            tracking-label-wide
            text-ink

            dark:text-white/90
          "
        >
          {known ? balance : "—"}
        </Text>
      </View>
    </Pressable>
  );
}
