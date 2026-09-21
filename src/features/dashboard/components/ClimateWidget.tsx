import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ClimateState } from "@/constants/climate";

export const NO_WEATHER_COPY =
  "Still finding today's weather. Choose a city in the weather panel to continue.";

/**
 * Today's conditions for her hub, as a porcelain card inside the hero.
 *
 * Two controls, matching the web: the city opens the hub sheet, the pin asks
 * the device where she is. The readout above them is not a target — a member
 * poking at a temperature expects nothing to happen, and making it tappable
 * would put a third invisible affordance on a card that already has two.
 *
 * The pin **suggests**; it never writes. §7 is explicit that a location is not
 * saved without confirmation, so it opens the same sheet with the device path
 * already running and "Set location" still the only thing that commits.
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
  onUseLocation,
}: {
  weather: ClimateState | undefined;
  loading: boolean;
  hasHub: boolean;
  onPress: () => void;
  onUseLocation: () => void;
}) {
  return (
    <View className="gap-md rounded-panel border border-border bg-surface p-lg dark:border-border/12">
      {loading ? (
        <>
          <View className="flex-row items-center gap-md">
            <Skeleton className="h-11 w-11 rounded-pill" />
            <View className="flex-1 gap-xs">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
            </View>
          </View>
          <Skeleton className="h-tap w-full rounded-pill" />
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
                  {weather.label}
                </Text>
                <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
                  {weather.location}
                </Text>
              </View>
            ) : (
              <Text className="flex-1 font-body text-sm text-body">{NO_WEATHER_COPY}</Text>
            )}
          </View>

          <View className="flex-row items-center gap-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                weather ? `City: ${weather.location}. Change it.` : "Choose your city"
              }
              onPress={onPress}
              className="active:opacity-90 min-h-tap flex-1 flex-row items-center justify-between rounded-pill border border-border bg-canvas px-lg dark:border-border/12"
            >
              <Text className="font-body text-base text-ink">
                {weather?.location ?? "Choose a city"}
              </Text>
              <Icon name="chevronDown" size="sm" color="muted" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
              accessibilityHint="Finds the city nearest you. You confirm it before it is saved."
              onPress={onUseLocation}
              className="active:opacity-90 h-tap w-tap items-center justify-center rounded-pill border border-border bg-canvas dark:border-border/12"
            >
              <Icon name="location" size="sm" color="ink" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
