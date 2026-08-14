import { Text, View } from "react-native";

import { Button } from "./Button";
import { Sheet } from "./Sheet";

/**
 * A confirmation, as a sheet. **Never `Alert.alert`** (§4) — the system dialog
 * is the one piece of UI Mila cannot style, and it turns a considered moment
 * into an OS interruption.
 *
 * Used for the two decisions a member cannot undo: spending a credit on a
 * second visual, and deleting a saved look.
 */
export function ConfirmSheet({
  visible,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
  destructive = false,
  loading = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** States the consequence plainly. A charge is named before the tap, not after. */
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View className="gap-lg">
        <Text className="font-body text-base text-body">{message}</Text>
        <Button
          label={confirmLabel}
          variant={destructive ? "destructive" : "primary"}
          loading={loading}
          onPress={onConfirm}
        />
        <Button label="Not now" variant="secondary" disabled={loading} onPress={onClose} />
      </View>
    </Sheet>
  );
}
