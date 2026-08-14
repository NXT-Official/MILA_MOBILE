import { Pressable, View } from "react-native";

import type { PostItem } from "@/lib/outfit-items";
import { touchTargets } from "@/theme/tokens";

/**
 * A tappable dot over a detected garment.
 *
 * `bbox` is normalised 0–1, so the dot lands on the piece at any render size —
 * which is the whole reason the parser stores it that way rather than in pixels.
 * Positioned by percentage on the box's centre.
 *
 * The visible dot is deliberately small and the touch target is not: the
 * `Pressable` is `tap`-sized and centred on the same point, so the control meets
 * the 44px floor without a 44px circle sitting on top of the outfit.
 */
export function GarmentHotspot({ item, onPress }: { item: PostItem; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}. See details and find similar pieces.`}
      onPress={onPress}
      // Case 1 of the StyleSheet exceptions: percentage offsets computed from
      // data cannot be expressed as utility classes.
      style={{
        position: "absolute",
        left: `${(item.bbox.x + item.bbox.w / 2) * 100}%`,
        top: `${(item.bbox.y + item.bbox.h / 2) * 100}%`,
        // Half the target, so the *centre* of the touch area lands on the
        // garment rather than its top-left corner.
        transform: [
          { translateX: -touchTargets.tap / 2 },
          { translateY: -touchTargets.tap / 2 },
        ],
      }}
      className="h-tap w-tap items-center justify-center"
    >
      {({ pressed }) => (
        <View
          className="h-lg w-lg items-center justify-center rounded-pill border border-canvas bg-ink/40"
          style={pressed ? { transform: [{ scale: 1.15 }] } : undefined}
        >
          <View className="h-sm w-sm rounded-pill bg-canvas" />
        </View>
      )}
    </Pressable>
  );
}
