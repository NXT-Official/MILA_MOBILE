import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { images } from "@/constants/images";
import { useThemeStore } from "@/stores/theme-store";
import { useAppliedTheme } from "@/theme/theme";

import { CreditsPill } from "./CreditsPill";

/**
 * Wordmark, balance, theme. Deliberately three things: this sits above the
 * greeting on the screen a member opens at 7:40am, and a fourth control here
 * would start turning the surface into a dashboard.
 */
export function HomeHeader({
  balance,
  creditsLoading,
  onCreditsPress,
}: {
  balance: number | null;
  creditsLoading: boolean;
  onCreditsPress: () => void;
}) {
  const { resolved } = useAppliedTheme();
  const setPreference = useThemeStore((s) => s.setPreference);
  const nextTheme = resolved === "dark" ? "light" : "dark";

  return (
    <View className="flex-row items-center justify-between gap-md py-md">
      {/* The mark carries its own palette (the colour-analysis motif) and is
          never re-tinted to a theme token — §11's brand-artwork carve-out. */}
      <View accessible accessibilityRole="header" className="flex-row items-center gap-sm">
        <Image
          source={images.logo}
          style={{ width: 28, height: 28 }}
          contentFit="contain"
          accessibilityLabel="Mila"
        />
        <Text className="font-display text-h3 tracking-label uppercase text-ink">Mila</Text>
      </View>

      <View className="flex-row items-center gap-md">
        <CreditsPill balance={balance} loading={creditsLoading} onPress={onCreditsPress} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${nextTheme} theme`}
          onPress={() => setPreference(nextTheme)}
          style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
          className="h-tap w-tap items-center justify-center"
        >
          <Icon name={resolved === "dark" ? "light" : "dark"} size="sm" color="body" />
        </Pressable>
      </View>
    </View>
  );
}
