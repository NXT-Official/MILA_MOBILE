import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ClimateState } from "@/constants/climate";

export const NO_WEATHER_COPY =
  "Still finding today's weather. Choose a city in the weather panel to continue.";

/**
 * Today's conditions for her hub. Tapping anywhere opens the hub sheet — the
 * whole row is the target, not a hidden chevron.
 *
 * Failure degrades to the hub-selection copy rather than an error card: a
 * missing temperature is not something a member can debug, but choosing a city
 * is something she can do.
 */
export function ClimateWidget({
  weather,
  loading,
  hasHub,
  onPress,
}: {
  weather: ClimateState | undefined;
  loading: boolean;
  hasHub: boolean;
  onPress: () => void;
}) {
  const label = weather
    ? `${weather.label}, ${weather.tempC} degrees, ${weather.location}. Change city.`
    : "Choose your city for today's weather.";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
      className="min-h-tap flex-row items-center gap-md"
    >
      {loading ? (
        <>
          <Skeleton className="h-7 w-7 rounded-pill" />
          <View className="flex-1 gap-xs">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
          </View>
        </>
      ) : weather ? (
        <>
          <Icon name={weather.icon} size="md" color="accent" />
          <View className="flex-1">
            <Text className="font-body-medium text-base text-ink">
              {weather.tempC}°C · {weather.label}
            </Text>
            <Text className="font-body text-sm text-body">{weather.location}</Text>
          </View>
          <Icon name="chevronDown" size="sm" color="muted" />
        </>
      ) : (
        <>
          <Icon name={hasHub ? "cloud" : "location"} size="md" color="muted" />
          <Text className="flex-1 font-body text-sm text-body">{NO_WEATHER_COPY}</Text>
          <Icon name="chevronDown" size="sm" color="muted" />
        </>
      )}
    </Pressable>
  );
}
