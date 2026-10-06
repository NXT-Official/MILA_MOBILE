import { Pressable, Text, View } from "react-native";

/**
 * The paywall sheet, stood in for — the screen only owes it a `visible` flag
 * and an `onClose`, and the test only asserts that the credit failure opened it
 * (§7: a sheet, never a toast) and what the screen says once it is dismissed.
 */
export function PaywallSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return (
    <View>
      <Text>paywall stub</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss paywall" onPress={onClose}>
        <Text>dismiss</Text>
      </Pressable>
    </View>
  );
}
