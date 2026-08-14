import { Text, View } from "react-native";

import { Skeleton } from "@/components/ui/Skeleton";
import { greeting } from "@/lib/greeting";

/**
 * The first line of the day. Re-evaluated on every render rather than cached:
 * the app is often resumed hours after it was opened, and "Good morning" at
 * 9pm is the kind of small lie that makes an assistant feel automated.
 */
export function Greeting({
  fullName,
  loading,
}: {
  fullName: string | null | undefined;
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-9 w-2/3" />;
  }

  return (
    <View>
      <Text
        accessibilityRole="header"
        className="font-display text-h1 tracking-heading text-ink"
      >
        {greeting(new Date(), fullName)}
      </Text>
    </View>
  );
}
