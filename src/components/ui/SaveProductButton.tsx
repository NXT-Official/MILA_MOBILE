import { AccessibilityInfo, Pressable, View } from "react-native";

import {
  useSavedProducts,
  useSetProductSaved,
  type SaveableProduct,
} from "@/hooks/use-saved-products";
import type { SaveSource } from "@/services/supabase/saved-products";
import { cn } from "@/utils/cn";

import { Icon } from "./Icon";

/**
 * The bookmark on a recommended piece: tap to keep it in Saved pieces, tap
 * again to let it go. Sits over the photo's top-right corner; the parent
 * places it.
 *
 * - **Hidden until the answer is known.** It renders only once her saved list
 *   has loaded, so it never shows the wrong state first, and it stays hidden
 *   while the saved-pieces table does not exist yet (`unavailable`).
 * - **Optimistic.** The glyph flips on the tap; a failed write flips it back
 *   and says so to a screen reader. A second tap waits for the first write.
 * - **State in shape, not hue** (§10): an outline bookmark when unsaved, a
 *   bookmark with a check when saved, on an ink fill.
 * - **Accessibility on an inner View.** `Pressable` drops unknown props, and
 *   react-native-web 0.21 ignores `accessibilityState`, so the View carries
 *   both `accessibilityState.selected` (native) and `aria-pressed` (web), and
 *   the Pressable is not a second focus stop.
 */
export function SaveProductButton({
  product,
  source,
  outfitId,
  postItemId,
}: {
  product: SaveableProduct;
  source: SaveSource;
  outfitId?: string;
  postItemId?: string;
}) {
  const list = useSavedProducts();
  const setSaved = useSetProductSaved();

  if (list.data?.status !== "ok") return null;

  const saved = list.data.items.some((item) => item.product_id === product.id);
  const busy = setSaved.isPending;

  // RN's View types stop at aria-selected/aria-checked; react-native-web reads
  // aria-pressed (and never accessibilityState) when it builds the DOM props.
  // src: react-native-web 0.21.2 · dist/modules/createDOMProps/index.js (ariaPressed)
  const webToggleState = { "aria-pressed": saved };

  return (
    <Pressable
      accessible={false}
      disabled={busy}
      onPress={() =>
        setSaved.mutate(
          { product, source, outfitId, postItemId, saved: !saved },
          {
            onError: () =>
              AccessibilityInfo.announceForAccessibility(
                saved ? "Couldn't remove it. Try again." : "Couldn't save it. Try again.",
              ),
          },
        )
      }
      className="active:opacity-85"
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Save ${product.title}`}
        accessibilityState={{ selected: saved, busy }}
        {...webToggleState}
        className={cn(
          "h-tap w-tap items-center justify-center rounded-pill",
          saved ? "bg-ink" : "border border-border bg-surface/90",
        )}
      >
        <Icon name={saved ? "bookmarkCheck" : "bookmark"} size="sm" color={saved ? "onInk" : "ink"} />
      </View>
    </Pressable>
  );
}
