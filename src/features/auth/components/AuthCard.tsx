import { router, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

import { Wordmark } from "./Wordmark";

/**
 * The segmented control is the navigation between the two auth routes.
 *
 * The design puts Log In and Sign Up on one card; §3 keeps them as separate
 * routes so they stay deep-linkable and guard-addressable. Both hold: the
 * control looks identical and `router.replace` swaps the route beneath it.
 */
function AuthTabs() {
  const pathname = usePathname();
  const onSignup = pathname.includes("signup");

  const tab = (label: string, active: boolean, href: "/login" | "/signup") => (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={() => !active && router.replace(href)}
      className={cn(
        "h-12 flex-1 items-center justify-center rounded-control",
        active ? "bg-surface border border-border dark:border-border/12" : "bg-transparent",
      )}
    >
      <Text className={cn("font-body-medium text-base", active ? "text-ink" : "text-muted")}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View className="w-full flex-row gap-xs rounded-control bg-surface-alt p-xs">
      {tab("Log In", !onSignup, "/login")}
      {tab("Sign Up", onSignup, "/signup")}
    </View>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <View className="w-full flex-row items-center gap-lg">
      <View className="h-px flex-1 bg-border dark:bg-border/12" />
      <Text className="font-body-semibold text-label tracking-label uppercase text-muted">
        {label}
      </Text>
      <View className="h-px flex-1 bg-border dark:bg-border/12" />
    </View>
  );
}

/**
 * The shared shell for every auth screen: wordmark, card, and the footer links.
 * `showTabs` is off on forgot-password, which is not one of the two modes.
 */
export function AuthCard({
  title,
  subtitle,
  showTabs = true,
  children,
}: {
  title: string;
  subtitle: string;
  showTabs?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="w-full gap-2xl py-xl">
      <Wordmark />

      <View className="w-full gap-xl rounded-card border border-border bg-surface p-xl dark:border-border/12">
        <View className="gap-xs">
          <Text className="font-display text-h2 tracking-heading text-ink">{title}</Text>
          <Text className="font-body text-base text-body">{subtitle}</Text>
        </View>

        {showTabs ? <AuthTabs /> : null}

        {children}

        <View className="flex-row items-center justify-center gap-sm">
          <Icon name="secure" size="xs" color="muted" />
          <Text className="font-body text-micro text-muted">
            Your sign-in is encrypted and secure.
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-center gap-xl">
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Studio help desk"
          onPress={() => Linking.openURL("mailto:hello@mila.app?subject=Studio%20Help%20Desk")}
          className="flex-row items-center gap-sm"
          hitSlop={8}
        >
          <Icon name="help" size="sm" color="muted" />
          <Text className="font-body text-sm text-muted">Studio Help Desk</Text>
        </Pressable>

        <View className="h-4 w-px bg-border dark:bg-border/12" />

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Send feedback"
          onPress={() => Linking.openURL("mailto:hello@mila.app?subject=Feedback")}
          className="flex-row items-center gap-sm"
          hitSlop={8}
        >
          <Icon name="feedback" size="sm" color="muted" />
          <Text className="font-body text-sm text-muted">Send Feedback</Text>
        </Pressable>
      </View>
    </View>
  );
}
