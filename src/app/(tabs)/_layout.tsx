import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabBar } from "@/components/layout/TabBar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useLensStore } from "@/stores/lens-store";
import { useThemeColors } from "@/theme/tailwind";
import { tabBar } from "@/theme/tokens";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "feed", title: "Feed", icon: "feed" },
  { name: "lens", title: "Lens", icon: "camera" },
  { name: "studio", title: "Studio", icon: "studio" },
  { name: "profile", title: "Profile", icon: "profile" },
  { name: "concierge", title: "Concierge", icon: "concierge" },
];

/**
 * The six tabs (§4), in a floating pill drawn by `TabBar` — the same set and
 * order the web shows: Home, Feed, Lens, Studio (try-on), Profile (dossier),
 * Concierge.
 *
 * Labels are off: six icon-only targets fit a 360dp screen where six labels do
 * not, and the name lives in `accessibilityLabel` rather than being truncated
 * to nonsense. The haptic fires in `TabBar` — `screenListeners` here would
 * double it on the one tab that also has its own listener.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // The sheet itself is mounted at the root, beside the header — the header's
  // Lens control opens the same one from the screens that have no tab bar.
  const openLens = useLensStore((s) => s.setOpen);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // The bar floats over the window rather than reserving layout space, so
        // every scene has to stop short of it itself. One place, not five.
        //
        // The background is not decoration: React Navigation's theme is never
        // configured here, so the scene container falls back to `DefaultTheme`,
        // whose background is white. The padding below holds a strip of that
        // container open beneath each screen's own `bg-canvas`, which is the
        // white band that showed under the floating bar in dark mode.
        sceneStyle: {
          backgroundColor: colors.canvas,
          paddingBottom: tabBar.clearance + insets.bottom,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            // `color` is typed `ColorValue`; TabBar always hands over a plain
            // hex, and anything else falls back to the token colour rather
            // than being coerced into a string lucide cannot read.
            tabBarIcon: ({ color }) => (
              <Icon
                name={tab.icon}
                size="md"
                rawColor={typeof color === "string" ? color : undefined}
              />
            ),
          }}
          listeners={
            tab.name === "lens"
              ? {
                  // Lens keeps its tab position but opens the Studio Lens sheet
                  // — the same entry the web gives it — and the sheet routes on
                  // to the full-screen camera, which is not letterboxed by the
                  // bar (§4).
                  tabPress: (e) => {
                    e.preventDefault();
                    openLens(true);
                  },
                }
              : undefined
          }
        />
      ))}
    </Tabs>
  );
}
