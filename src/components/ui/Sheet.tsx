import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { BackHandler, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radii, shadows, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/tailwind";

/**
 * Every dialog in Mila is a bottom sheet (§4). Nothing presents as a centred
 * desktop-style modal, and destructive confirmations never use `Alert.alert`.
 *
 * Declarative `visible` in, `onClose` out — the imperative present/dismiss pair
 * stays inside here so no feature has to hold a sheet ref.
 */
type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Announced as the sheet's heading. Every sheet has one. */
  title: string;
  /**
   * How tall the sheet opens. Content taller than this scrolls; shorter
   * content leaves space below it, which is the trade for a sheet that is
   * always visible. See the note on `snapPoints` below.
   */
  height?: `${number}%`;
  children: ReactNode;
};

/**
 * A fixed detent, deliberately, instead of `enableDynamicSizing`.
 *
 * `useAnimatedDetents` bails out with **no detents at all** while dynamic
 * sizing is on and the content height is still unmeasured:
 *
 *     if (!enableDynamicSizing) return { detents, ... };
 *     if (contentHeight === INITIAL_LAYOUT_VALUE) return {};
 *
 * A sheet with no detent has nowhere to snap to, so it presents to nothing —
 * the member taps and the screen simply does not change. Note the order: that
 * bail-out happens *before* provided snap points are considered, so supplying
 * both does not help. Measuring is the fragile part; a number is not.
 */
const DEFAULT_HEIGHT = "70%";

export function Sheet({ visible, onClose, title, height = DEFAULT_HEIGHT, children }: SheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const snapPoints = useMemo(() => [height], [height]);

  /**
   * Only ever dismiss a sheet that is actually up.
   *
   * `BottomSheetModal.handleDismiss` has no early exit for its `INITIAL`
   * status — the list it checks is `[CLOSED, MINIMIZED]` — so a dismiss on a
   * sheet that was never presented falls through, parks the status at
   * `DISMISSING`, and calls `forceClose()` on a ref that is still null. Nothing
   * ever calls `unmount()`, which is what would reset the status. From then on
   * `handlePortalRender` sees `DISMISSING` and returns **without rendering the
   * portal**, so `present()` mounts the sheet and paints nothing, forever.
   *
   * This effect used to hit that on its very first run: every sheet mounts with
   * `visible === false` and dismissed itself into the wedged state before the
   * member had touched anything. The second route in is the close path — the
   * sheet unmounts itself on swipe-down or a backdrop press, and the resulting
   * `visible === false` would send a dismiss to an already-gone sheet.
   */
  const presented = useRef(false);

  useEffect(() => {
    if (visible) {
      presented.current = true;
      ref.current?.present();
    } else if (presented.current) {
      presented.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  /**
   * Android's Back is the primary way a member dismisses a sheet, and the
   * hardware button belongs to the top-most thing on screen. Without this it
   * reached the tab navigator underneath — closing the app on Home, or
   * switching the tab behind an orphaned sheet on Concierge (MMM-A1). While
   * this sheet is up it consumes Back and closes itself, and nothing else.
   */
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
        style={[props.style, { backgroundColor: colors.ink }]}
        pressBehavior="close"
      />
    ),
    [colors.ink],
  );

  return (
    <BottomSheetModal
      ref={ref}
      // Case 1 of the StyleSheet exceptions throughout: these are third-party
      // props that take style objects, and NativeWind cannot reach them.
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.overlay,
        borderTopRightRadius: radii.overlay,
      }}
      style={shadows.nav}
      handleIndicatorStyle={{ width: 36, height: 4, backgroundColor: colors.border }}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      // A measured height, never a derived one — see the note above the
      // default. `index={0}` opens on the single detent rather than closed.
      snapPoints={snapPoints}
      index={0}
      enableDynamicSizing={false}
      // The sheet also closes itself — swipe down, backdrop press. Clearing the
      // latch here is what stops the resulting `visible === false` from sending
      // a dismiss to a sheet that has already unmounted.
      onDismiss={() => {
        presented.current = false;
        onClose();
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.lg,
        }}
      >
        <View className="gap-lg">
          <Text accessibilityRole="header" className="font-display text-h3 text-ink">
            {title}
          </Text>
          {children}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
