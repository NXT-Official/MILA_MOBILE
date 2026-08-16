import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHaptics } from "@/hooks/use-haptics";
import { colors, radii, shadows, tabBar } from "@/theme/tokens";

/**
 * The bar is ink in **both** themes, so its foreground colours are fixed rather
 * than theme-reactive: `useThemeColors().surface` would resolve to a near-black
 * in dark mode and the inactive tabs would disappear against their own bar.
 * These are the ink-ground values, and they do not flip.
 *
 * Alpha is carried in the hex suffix rather than an `opacity` style key —
 * `opacity` fades the icons along with the ground, which is a dimmed tab bar,
 * not a translucent one.
 */
const BAR_GROUND = `${colors.light.ink}e6`; // 90%
const ACTIVE_TINT = colors.light.accent;
const INACTIVE_TINT = `${colors.light.surface}80`; // 50%
const HAIRLINE = "rgba(255,255,255,0.1)";

/**
 * A floating pill, inset from the left, right, and bottom edges — the same bar
 * the web shows at mobile width.
 *
 * Written out rather than assembled from `tabBarStyle` overrides because the
 * default bar derives its own padding from the screen edge it is attached to,
 * and this one is not attached to that edge. Owning the geometry outright keeps
 * every number in `theme/tokens.ts` instead of half here and half inside the
 * navigator's inset maths.
 *
 * Icons come from each screen's `tabBarIcon`, so the tab list stays declared in
 * `app/(tabs)/_layout.tsx` and this file never learns what the tabs are.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  return (
    <View
      accessibilityRole="tablist"
      // Case 1 of the StyleSheet exceptions: a navigator's bar is positioned
      // against the window, which no layout class expresses.
      style={{
        position: "absolute",
        left: tabBar.inset,
        right: tabBar.inset,
        bottom: tabBar.inset + insets.bottom,
        height: tabBar.height,
        borderRadius: radii.pill,
        backgroundColor: BAR_GROUND,
        borderWidth: 1,
        borderColor: HAIRLINE,
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
        ...shadows.nav,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key] ?? {};
        const focused = state.index === index;
        const label = options?.tabBarAccessibilityLabel ?? options?.title ?? route.name;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              haptics.selection();
              // The navigator's own contract: a screen's `listeners` may cancel
              // this, which is how Lens presents full-screen instead of as a
              // tab. Navigating without emitting would bypass that.
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
            className="h-full flex-1 items-center justify-center"
          >
            {options?.tabBarIcon?.({
              focused,
              color: focused ? ACTIVE_TINT : INACTIVE_TINT,
              size: 22,
            })}
          </Pressable>
        );
      })}
    </View>
  );
}
