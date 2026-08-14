import { router } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IconName } from "@/components/ui/Icon";

/**
 * A tab that exists in the navigator but not yet in the product.
 *
 * The navigator declares five tabs, so all five route files must exist or the
 * router throws. Rather than a blank screen, each one names the phase that
 * fills it — a member who wanders in learns something, and so does anyone
 * picking the project up mid-build.
 */
export function PhasePlaceholder({
  icon,
  title,
  description,
  onBack = false,
}: {
  icon: IconName;
  title: string;
  description: string;
  /** Full-screen routes have no tab bar to escape through. */
  onBack?: boolean;
}) {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-lg">
        <EmptyState icon={icon} title={title} description={description} />
        {onBack ? <Button label="Back" variant="secondary" onPress={() => router.back()} /> : null}
      </View>
    </Screen>
  );
}
