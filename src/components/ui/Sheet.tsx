import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Text, useWindowDimensions, View } from "react-native";
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
  children: ReactNode;
};

export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const colors = useThemeColors();

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
      // Grow to fit the content, then scroll — so a two-line confirmation is
      // not a half-screen panel and the 11-vibe list is not clipped.
      enableDynamicSizing
      maxDynamicContentSize={height * 0.8}
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
