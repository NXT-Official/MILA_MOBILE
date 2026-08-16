import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ClimateState } from "@/constants/climate";

export const NO_WEATHER_COPY =
  "Still finding today's weather. Choose a city in the weather panel to continue.";

/**
 * Today's conditions for her hub, as a porcelain card inside the hero.
 *
 * The whole card is one target, not a hidden chevron — and one target rather
 * than a nested pressable per row, because the readout and the city pill do the
 * same thing: open the hub sheet.
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
      className="gap-md rounded-panel border border-border bg-surface p-lg dark:border-border/12"
    >
      {loading ? (
        <>
          <View className="flex-row items-center gap-md">
            <Skeleton className="h-11 w-11 rounded-pill" />
            <View className="flex-1 gap-xs">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
            </View>
          </View>
          <Skeleton className="h-11 w-full rounded-pill" />
        </>
      ) : (
        <>
          <View className="flex-row items-center gap-md">
            <View className="h-11 w-11 items-center justify-center rounded-pill border border-border bg-canvas dark:border-border/12">
              <Icon
                name={weather ? weather.icon : hasHub ? "cloud" : "location"}
                size="sm"
                color={weather ? "accent" : "muted"}
              />
            </View>

            {weather ? (
              <View className="flex-1 gap-xs">
                <Text className="font-body-medium text-base text-ink">
                  {weather.tempC}°C {weather.label}
                </Text>
                <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
                  {weather.location}
                </Text>
              </View>
            ) : (
              <Text className="flex-1 font-body text-sm text-body">{NO_WEATHER_COPY}</Text>
            )}
          </View>

          {/* Reads as the select it behaves like, without being a second
              target — the card above already opens the same sheet. */}
          <View className="min-h-tap flex-row items-center justify-between rounded-pill border border-border bg-canvas px-lg dark:border-border/12">
            <Text className="font-body text-base text-ink">
              {weather?.location ?? "Choose a city"}
            </Text>
            <Icon name="chevronDown" size="sm" color="muted" />
          </View>
        </>
      )}
    </Pressable>
  );
}
