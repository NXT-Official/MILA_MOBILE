import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CreditsPill } from "@/components/ui/CreditsPill";
import { Icon } from "@/components/ui/Icon";
import { images } from "@/constants/images";
import { useCreditBalance, useCredits } from "@/hooks/use-credits";
import { useThemeStore } from "@/stores/theme-store";
import { useAppliedTheme } from "@/theme/theme";

/**
 * Wordmark, balance, theme — on every signed-in page, as on the web.
 *
 * Mounted once above the navigator in `app/_layout.tsx`, never by a screen. It
 * sources its own data rather than taking props: a global surface that each
 * screen had to feed would be a global surface each screen could forget to
 * feed, and the balance would silently differ by page.
 *
 * Deliberately three things. This sits above every screen in the app, and a
 * fourth control here is how a calm surface turns into a dashboard.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { resolved } = useAppliedTheme();
  const setPreference = useThemeStore((s) => s.setPreference);
  const nextTheme = resolved === "dark" ? "light" : "dark";

  const { isPending } = useCredits();
  const balance = useCreditBalance();

  return (
    // The header owns the notch. Everything below it is handed insets with the
    // top already spent — see the provider in `app/_layout.tsx`.
    <View style={{ paddingTop: insets.top }} className="bg-canvas px-lg">
      <View className="flex-row items-center justify-between gap-md py-sm">
        {/* The mark carries its own palette (the colour-analysis motif) and is
            never re-tinted to a theme token — §11's brand-artwork carve-out. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mila. Go to your home screen."
          onPress={() => router.navigate("/(tabs)")}
          className="active:opacity-80 min-h-tap flex-row items-center gap-sm"
        >
          <Image
            source={images.logo}
            style={{ width: 28, height: 28 }}
            contentFit="contain"
          />
          <Text className="font-display text-h3 tracking-label uppercase text-ink">
            Mila
          </Text>
        </Pressable>

        <View className="flex-row items-center gap-md">
          <CreditsPill
            balance={balance}
            loading={isPending}
            onPress={() => router.push("/membership")}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${nextTheme} theme`}
            onPress={() => setPreference(nextTheme)}
            className="active:opacity-60 h-tap w-tap items-center justify-center"
          >
            <Icon
              name={resolved === "dark" ? "light" : "dark"}
              size="sm"
              color="body"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
