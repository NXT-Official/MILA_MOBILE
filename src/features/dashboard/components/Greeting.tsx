import { Text, View } from "react-native";

import { Skeleton } from "@/components/ui/Skeleton";
import { greeting } from "@/lib/greeting";

/**
 * The first line of the day. Re-evaluated on every render rather than cached:
 * the app is often resumed hours after it was opened, and "Good morning" at
 * 9pm is the kind of small lie that makes an assistant feel automated.
 *
 * The full stop is added here, not in `lib/greeting.ts` — the string is also
 * read aloud and reused, and punctuation is presentation.
 */
export function Greeting({
  fullName,
  loading,
}: {
  fullName: string | null | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <View className="gap-md">
        <Skeleton className="h-2xl w-2/3" />
        <Skeleton className="h-lg w-full" />
      </View>
    );
  }

  return (
    <View className="gap-md">
      <Text
        accessibilityRole="header"
        className="font-display text-display tracking-display text-ink"
      >
        {greeting(new Date(), fullName)}.
      </Text>
      <Text className="font-body text-base text-body">
        Let Mila compose an ideal OOTD for today&apos;s weather, your palette, and your silhouette.
      </Text>
    </View>
  );
}
