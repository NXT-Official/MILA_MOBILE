import { Text } from "react-native";

/**
 * The paywall sheet, stood in for — the screen only owes it a `visible` flag,
 * and the test only asserts that the credit failure opened it (§7: a sheet,
 * never a toast).
 */
export function PaywallSheet({ visible }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return <Text>paywall stub</Text>;
}
