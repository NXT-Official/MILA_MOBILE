import { router } from "expo-router";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** PHASE 00 SCAFFOLDING — delete when Home lands in Phase 03. */
export default function NavigationCheck() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-lg">
        <Icon name="check" size="xl" color="success" />
        <Text className="font-display text-h2 tracking-heading text-ink text-center">
          Navigation works
        </Text>
        <Text className="font-body text-base text-body text-center">
          The router resolved a nested route, the safe-area insets applied, and the theme carried
          across the transition.
        </Text>
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
