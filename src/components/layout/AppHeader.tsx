import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountSheet } from "@/components/layout/AccountSheet";
import { CreditsPill } from "@/components/ui/CreditsPill";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { images } from "@/constants/images";
import { useCreditBalance, useCredits } from "@/hooks/use-credits";
import { useProfile } from "@/hooks/use-profile";
import { useThemeStore } from "@/stores/theme-store";
import { useAppliedTheme } from "@/theme/theme";

/**
 * Wordmark, balance, theme, avatar — on every signed-in page, as on the web.
 *
 * Mounted once above the navigator in `app/_layout.tsx`, never by a screen. It
 * sources its own data rather than taking props: a global surface that each
 * screen had to feed would be a global surface each screen could forget to
 * feed, and the balance would silently differ by page.
 *
 * Deliberately these four (§3.5) and no more. This sits above every screen in
 * the app, and a fifth control here is how a calm surface turns into a
 * dashboard.
 */
export function AppHeader() {
  const [accountOpen, setAccountOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { resolved } = useAppliedTheme();
  const setPreference = useThemeStore((s) => s.setPreference);
  const nextTheme = resolved === "dark" ? "light" : "dark";

  const { isPending } = useCredits();
  const balance = useCreditBalance();

  const { data: profile, isPending: profilePending } = useProfile();
  // ponytail: first letter, same rule as the dossier monogram. A member with
  // no name yet gets the brand's own initial rather than an empty circle.
  const monogram = (profile?.full_name?.trim() || "M")[0].toUpperCase();

  return (
    // The header owns the notch. Everything below it is handed insets with the
    // top already spent — see the provider in `app/_layout.tsx`.
    <View style={{ paddingTop: insets.top }} className="bg-canvas px-lg pb-3">
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

          {/* The account entry, as the web's header avatar: it opens the same
              membership drawer content, presented as a sheet. */}
          {profilePending ? (
            <Skeleton className="h-10 w-10 rounded-pill" />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Your account, membership, and settings"
              onPress={() => setAccountOpen(true)}
              className="active:opacity-80 min-h-tap items-center justify-center"
            >
              <View className="h-10 w-10 items-center justify-center rounded-pill border border-border bg-surface">
                <Text className="font-display text-sm text-ink">
                  {monogram}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>

      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </View>
  );
}
