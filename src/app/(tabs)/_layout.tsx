import { Tabs, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { useHaptics } from "@/hooks/use-haptics";
import { colors } from "@/theme/tokens";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "feed", title: "Feed", icon: "feed" },
  { name: "lens", title: "Lens", icon: "camera" },
  { name: "studio", title: "Studio", icon: "studio" },
  { name: "concierge", title: "Concierge", icon: "concierge" },
];

/**
 * The bar is ink in **both** themes, so its foreground colours are fixed rather
 * than theme-reactive: `useThemeColors().surface` would resolve to a near-black
 * in dark mode and the inactive tabs would disappear against their own bar.
 * These are the ink-ground values, and they do not flip.
 *
 * Alpha is carried in the hex suffix rather than a `opacity` style key —
 * `opacity` fades the icons and labels along with the ground, which is a
 * dimmed tab bar, not a translucent one.
 */
const BAR_GROUND = `${colors.dark.canvas}e6`; // 90%
const INACTIVE_TINT = `${colors.light.surface}80`; // 50%
const HAIRLINE = colors.dark.border;

/**
 * The five tabs (§4). Navigator options take style objects, so tokens are read
 * from the token module rather than through classes — case 1 of the StyleSheet
 * exceptions.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.light.accent,
        tabBarInactiveTintColor: INACTIVE_TINT,
        tabBarStyle: {
          backgroundColor: BAR_GROUND,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          borderTopWidth: 1,
          borderTopColor: HAIRLINE,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
        },
      }}
      screenListeners={{ tabPress: () => haptics.selection() }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <Icon
                name={tab.icon}
                size="md"
                rawColor={focused ? colors.light.accent : INACTIVE_TINT}
              />
            ),
          }}
          listeners={
            tab.name === "lens"
              ? {
                  // Lens keeps its tab position but presents full-screen, so
                  // the camera is not letterboxed by the bar (§4). The haptic
                  // is already fired by `screenListeners` above — repeating it
                  // here would buzz twice on this one tab.
                  tabPress: (e) => {
                    e.preventDefault();
                    router.push("/lens-capture");
                  },
                }
              : undefined
          }
        />
      ))}
    </Tabs>
  );
}
