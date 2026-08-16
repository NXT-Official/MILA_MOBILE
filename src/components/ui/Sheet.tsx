import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Text, View } from "react-native";
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

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
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
      onDismiss={onClose}
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
