import { Text, View } from "react-native";

/**
 * A member's 16-season colour identity.
 *
 * The one place a saturated non-brand colour is not only allowed but required:
 * **the swatch colour is data** (§11). Which is exactly why the name is not
 * optional — a portion of the audience cannot distinguish these swatches at
 * all, and for them the hue carries nothing.
 *
 * So the season's name is always rendered beside the swatch, and the swatch
 * itself is hidden from assistive tech. Removing the name to make the tag
 * "cleaner" would delete the content and leave only the decoration.
 */
export function SeasonTag({
  season,
  /** The season's representative hex — member data, not a theme token. */
  hex,
}: {
  season: string;
  hex: string;
}) {
  return (
    <View className="flex-row items-center gap-sm self-start rounded-pill border border-border bg-surface px-md py-xs dark:border-border/12">
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        // Case 1 of the StyleSheet exceptions: the colour is data and cannot
        // come from a utility class.
        style={{ backgroundColor: hex }}
        className="h-sm w-sm rounded-pill border border-border dark:border-border/12"
      />
      <Text className="font-body-semibold text-label tracking-label uppercase text-ink">
        {season}
      </Text>
    </View>
  );
}
