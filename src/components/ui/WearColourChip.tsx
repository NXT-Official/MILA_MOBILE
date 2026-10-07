import { Text, View } from "react-native";

import { asWearColour, type WearColour } from "@/lib/wear-colour";

/**
 * Which of her colours to wear a piece in, over its product photo. A solid ink
 * pill with on-ink text, like GarmentBadge, so it reads on any photo. The dot
 * is her swatch, painted from the validated hex only and hidden from assistive
 * tech: the colour's name is always the visible text, so colour alone never
 * carries it.
 *
 * The parent supplies the positioning context (the photo's own View).
 */
export function WearColourChip({ wear }: { wear: WearColour | null | undefined }) {
  // A look recovered from storage arrives unchecked: paint only a whole, safe colour.
  const colour = asWearColour(wear);
  if (!colour) return null;

  return (
    <View
      accessible
      // A role, so react-native-web keeps the name (see GarmentBadge).
      accessibilityRole="image"
      accessibilityLabel={`Wear it in ${colour.name}`}
      className="flex-row items-center gap-xs self-start rounded-pill bg-ink px-sm py-xs"
    >
      <View
        testID="colour-dot"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="h-3 w-3 rounded-pill border border-on-ink"
        // StyleSheet exception 1 (measured): her swatch hex is runtime data, not a token.
        style={{ backgroundColor: colour.hex }}
      />
      <Text numberOfLines={1} className="shrink font-body-medium text-micro text-on-ink">
        {colour.name}
      </Text>
    </View>
  );
}
