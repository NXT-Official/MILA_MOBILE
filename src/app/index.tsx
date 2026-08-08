import { Link } from "expo-router";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Icon } from "@/components/ui/Icon";
import { useSignOut } from "@/features/auth/hooks/use-auth-actions";
import { useAuthStore } from "@/stores/auth-store";
import { useThemeStore, type ThemePreference } from "@/stores/theme-store";
import { useAppliedTheme } from "@/theme/theme";

/**
 * PHASE 00 SCAFFOLDING — delete when Home lands in Phase 03.
 *
 * Exists to prove the foundation on a real device: routing, NativeWind classes,
 * design tokens, both font families, the icon registry, and theme switching.
 */
const PREFERENCES: ThemePreference[] = ["light", "dark", "system"];

export default function FoundationCheck() {
  const { preference, resolved } = useAppliedTheme();
  const setPreference = useThemeStore((s) => s.setPreference);
  const email = useAuthStore((s) => s.session?.user.email ?? null);
  const signOut = useSignOut();

  return (
    <Screen scroll>
      <View className="gap-xl py-2xl">
        <View className="gap-xs">
          <Text className="font-body-semibold text-section tracking-section uppercase text-muted">
            Phase 00
          </Text>
          <Text className="font-display-bold text-display tracking-display text-ink">Mila</Text>
          <Text className="font-body text-base text-body">
            Foundation check. Everything on this screen is scaffolding and is deleted in Phase 03.
          </Text>
        </View>

        <Divider />

        <Card>
          <Text className="font-display text-h3 text-ink mb-md">Typography</Text>
          <Text className="font-display text-h1 tracking-heading text-ink">Playfair H1</Text>
          <Text className="font-body text-base text-body mt-sm">
            Inter body copy at 15/24 — the default for everything that is not a heading.
          </Text>
          <Text className="font-body text-micro text-muted mt-sm">Inter micro 11/16</Text>
        </Card>

        <Card>
          <Text className="font-display text-h3 text-ink mb-md">Icons</Text>
          <View className="flex-row items-center gap-lg">
            <Icon name="home" size="xs" />
            <Icon name="feed" size="sm" />
            <Icon name="camera" size="md" />
            <Icon name="studio" size="lg" color="accent" />
            <Icon name="concierge" size="xl" color="muted" />
          </View>
        </Card>

        <Card>
          <Text className="font-display text-h3 text-ink mb-md">Colour tokens</Text>
          <View className="flex-row flex-wrap gap-sm">
            {["bg-canvas", "bg-surface", "bg-surface-alt", "bg-ink", "bg-accent", "bg-rose"].map(
              (token) => (
                <View
                  key={token}
                  className={`h-12 w-12 rounded-control border border-border ${token}`}
                />
              ),
            )}
          </View>
        </Card>

        <Card>
          <Text className="font-display text-h3 text-ink mb-md">
            Theme — {preference} ({resolved})
          </Text>
          <View className="flex-row gap-sm">
            {PREFERENCES.map((p) => (
              <Button
                key={p}
                label={p}
                size="chip"
                variant={preference === p ? "primary" : "outline"}
                onPress={() => setPreference(p)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <Text className="font-display text-h3 text-ink mb-md">Buttons</Text>
          <View className="gap-sm">
            <Button label="Primary" variant="primary" />
            <Button label="Secondary" variant="secondary" />
            <Button label="Outline" variant="outline" />
            <Button label="Loading" loading />
            <Button label="Disabled" disabled />
          </View>
        </Card>

        <Card>
          <Text className="font-display text-h3 text-ink mb-md">Session</Text>
          <Text className="font-body text-sm text-body mb-md">
            {email ?? "no session"}
          </Text>
          <Button
            label="Sign out"
            variant="secondary"
            loading={signOut.isPending}
            onPress={() => signOut.mutate()}
          />
        </Card>

        <Link href="/foundation/navigation-check" asChild>
          <Button label="Check navigation" variant="secondary" />
        </Link>
      </View>
    </Screen>
  );
}
