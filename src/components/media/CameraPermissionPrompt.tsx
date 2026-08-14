import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * The rationale, shown **before** the system dialog and never at launch (§10).
 * A member who understands why the camera is wanted grants it; one ambushed by
 * an OS prompt on the splash screen denies it, and on Android a second denial
 * is permanent.
 *
 * One component for both refusals because the shape is identical — an icon, a
 * reason, one button. Only the button changes, and that difference is exactly
 * what §12 says matters: a `"denied"` prompt can ask again, a `"blocked"` one
 * must deep-link to settings or it taps into a void.
 *
 * Lives in `components/` rather than beside Lens because the feed's dual capture
 * needs the same screen — and a feature may never import another feature's
 * internals (§5).
 */
export function CameraPermissionPrompt({
  status,
  requesting,
  onAllow,
  onOpenSettings,
}: {
  status: "denied" | "blocked";
  requesting: boolean;
  onAllow: () => void;
  onOpenSettings: () => void;
}) {
  const blocked = status === "blocked";

  return (
    <View className="flex-1 items-center justify-center gap-lg px-xl">
      <Icon name="camera" size="xl" color="muted" />

      <Text accessibilityRole="header" className="font-display text-h2 text-ink text-center">
        {blocked ? "Camera access is turned off" : "Mila needs your camera"}
      </Text>

      <Text className="font-body text-base text-body text-center">
        {blocked
          ? "Turn the camera on for Mila in your device settings, then come back to read an outfit."
          : "One photo of what you are wearing, read against your season and your silhouette. Nothing leaves your account."}
      </Text>

      <Button
        label={blocked ? "Open settings" : "Allow camera"}
        loading={requesting}
        onPress={blocked ? onOpenSettings : onAllow}
        className="w-full"
      />
    </View>
  );
}
