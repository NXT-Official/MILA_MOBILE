import { AccessibilityInfo, Pressable, View } from "react-native";

import {
  useSavedProducts,
  useSaveFailure,
  useSetProductSaved,
  type SaveableProduct,
} from "@/hooks/use-saved-products";
import type { SaveSource } from "@/services/supabase/saved-products";
import { cn } from "@/utils/cn";

import { InlineError } from "./ErrorState";
import { Icon } from "./Icon";

/** The words for a failed write, shown under the card and spoken by a screen reader. */
const FAILED_SAVE = "That didn't save. Check your connection and try again.";
const FAILED_REMOVE = "That wasn't removed. Check your connection and try again.";

/**
 * The bookmark on a recommended piece: tap to keep it in Saved pieces, tap
 * again to let it go. Sits over the photo's top-right corner; the parent
 * places it.
 *
 * - **Hidden until the answer is known.** It renders only once her saved list
 *   has loaded, so it never shows the wrong state first, and it stays hidden
 *   while the saved-pieces table does not exist yet (`unavailable`).
 * - **Optimistic.** The glyph flips on the tap; a failed write flips it back,
 *   says so to a screen reader, and `SaveFailedNotice` says so in words under
 *   the card. A second tap waits for the first write.
 * - **State in shape, not hue** (§10): an outline bookmark when unsaved, a
 *   bookmark with a check when saved, on an ink fill.
 * - **One control, named, that handles its own press.** TalkBack's double-tap
 *   is an accessibility click on the focused element, and Pressability ignores
 *   a click whose target is a nested view, so the focusable element must be
 *   the Pressable itself. It carries `accessibilityState.selected` (native) and
 *   `aria-pressed` (web): RN 0.86's Pressable passes `aria-pressed` through to
 *   its host, and react-native-web's forwards it to the DOM, where
 *   `accessibilityState` is ignored. On web this is also the only tab stop.
 *   // src: react-native 0.86.3 · Libraries/Pressability/Pressability.js (onClick)
 *   // src: react-native-web 0.21.2 · dist/exports/Pressable/index.js (rest props
 *   //   and tabIndex on the host View), dist/modules/createDOMProps (ariaPressed)
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

  // RN's types stop at aria-selected/aria-checked, so the web toggle state is
  // spread rather than written as a prop.
  const webToggleState = { "aria-pressed": saved };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Save ${product.title}`}
      accessibilityState={{ selected: saved, busy }}
      {...webToggleState}
      disabled={busy}
      onPress={() =>
        setSaved.mutate(
          { product, source, outfitId, postItemId, saved: !saved },
          {
            // VoiceOver ignores live regions, so the failure is also announced.
            onError: () =>
              AccessibilityInfo.announceForAccessibility(saved ? FAILED_REMOVE : FAILED_SAVE),
          },
        )
      }
      className={cn(
        "h-tap w-tap items-center justify-center rounded-pill active:opacity-85",
        saved ? "bg-ink" : "border border-border bg-surface/90 dark:border-border/12",
      )}
    >
      <Icon name={saved ? "bookmarkCheck" : "bookmark"} size="sm" color={saved ? "onInk" : "ink"} />
    </Pressable>
  );
}

/**
 * The visible half of a failed save or removal: the app's inline error, placed
 * by the card under its own text (the bookmark sits on the photo, where a
 * sentence has no room). It stays until her next tap on that bookmark.
 */
export function SaveFailedNotice({ productId }: { productId: string }) {
  const failure = useSaveFailure(productId);
  if (!failure) return null;
  return (
    // Its own spacing, so a card gains no gap while nothing has failed.
    <View className="pt-sm">
      <InlineError message={failure === "save" ? FAILED_SAVE : FAILED_REMOVE} />
    </View>
  );
}
