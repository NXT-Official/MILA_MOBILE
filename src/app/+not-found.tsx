import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <View className="flex-1 items-center justify-center gap-lg">
          <Icon name="alert" size="lg" color="muted" />
          <Text className="font-display text-h2 tracking-heading text-ink text-center">
            This page has moved
          </Text>
          <Text className="font-body text-base text-body text-center">
            The link you followed does not lead anywhere in Mila.
          </Text>
          <Link href="/" asChild>
            <Button label="Back to Mila" variant="secondary" />
          </Link>
        </View>
      </Screen>
    </>
  );
}
