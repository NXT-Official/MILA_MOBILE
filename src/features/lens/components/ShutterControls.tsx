import { Pressable, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/utils/cn";

/**
 * Gallery · shutter · flip, the §3 order.
 *
 * The shutter is a ring rather than an icon: a camera shutter is a universally
 * understood shape, and Lucide has no glyph for it that does not read as
 * "settings". Both satellites are `tap`-sized with labels, because an icon-only
 * control needs both (§11).
 */
export function ShutterControls({
  busy,
  onCapture,
  onPickFromLibrary,
  onFlip,
}: {
  /** A capture is in flight, or the preview has not started streaming yet. */
  busy: boolean;
  onCapture: () => void;
  onPickFromLibrary: () => void;
  onFlip: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between px-xl py-lg">
      <SatelliteButton
        icon="gallery"
        label="Choose a photo from your gallery"
        disabled={busy}
        onPress={onPickFromLibrary}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Take a photo"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onCapture}
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.94 }] } : undefined)}
        className="h-tile w-tile items-center justify-center rounded-pill border border-ink"
      >
        <View className={cn("h-2xl w-2xl rounded-pill bg-ink", busy && "opacity-50")} />
      </Pressable>

      <SatelliteButton
        icon="flipCamera"
        label="Switch between front and back camera"
        disabled={busy}
        onPress={onFlip}
      />
    </View>
  );
}

function SatelliteButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
      className={cn("h-tap w-tap items-center justify-center", disabled && "opacity-50")}
    >
      <Icon name={icon} size="lg" color="ink" />
    </Pressable>
  );
}
