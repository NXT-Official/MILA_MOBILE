import { Text, View } from "react-native";

import type { Garment } from "@/lib/garment-label";

import { Icon } from "./Icon";

/** "Mila is recommending the jeans": the sentence a screen reader hears for the badge. */
export function recommendingLabel(label: string): string {
  return `Mila is recommending the ${label.toLowerCase()}`;
}

/**
 * Which piece of a whole-outfit photo Mila means, pinned to the photo's
 * bottom-left corner. The top-left belongs to the discount badge and the
 * top-right to the save button, so the three never collide.
 *
 * Solid ink with the on-ink text token, never a translucent wash: it sits over
 * an arbitrary photograph, and only a solid fill keeps the label at AA contrast
 * whatever is underneath. Never icon-only (§10, the Colour-Is-Content rule): the
 * word is always on screen and the glyph is decoration beside it, hidden from
 * assistive tech so the label is read once.
 *
 * The parent supplies the positioning context (the image's own View).
 */
export function GarmentBadge({ garment }: { garment: Garment }) {
  return (
    <View
      accessible
      // A role, so react-native-web keeps the name: it renders role="img" with
      // the label, where a role-less element's aria-label is dropped. "text"
      // would map to no role at all on web.
      // src: react-native-web 0.21.2 · dist/modules/AccessibilityUtil/propsToAriaRole.js
      accessibilityRole="image"
      accessibilityLabel={recommendingLabel(garment.label)}
      className="absolute bottom-sm left-sm flex-row items-center gap-xs rounded-pill bg-ink px-sm py-xs"
    >
      <Icon name={garment.icon} size="xs" color="onInk" />
      <Text numberOfLines={1} className="shrink font-body-medium text-micro text-on-ink">
        {garment.label}
      </Text>
    </View>
  );
}
