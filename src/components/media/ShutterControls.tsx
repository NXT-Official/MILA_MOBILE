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
 *
 * `onFlip` is optional: the feed's dual capture fixes the camera per step — each
 * half of an OOTD is a specific shot — so the control is withheld rather than
 * shown and ignored. The slot is still reserved, so the shutter stays centred.
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
  onFlip?: () => void;
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
        className="active:scale-94 h-tile w-tile items-center justify-center rounded-pill border border-ink"
      >
        <View className={cn("h-2xl w-2xl rounded-pill bg-ink", busy && "opacity-50")} />
      </Pressable>

      {onFlip ? (
        <SatelliteButton
          icon="flipCamera"
          label="Switch between front and back camera"
          disabled={busy}
          onPress={onFlip}
        />
      ) : (
        // An empty target-sized box, so removing the control does not slide the
        // shutter off centre.
        <View className="h-tap w-tap" />
      )}
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
      className={cn(
        "active:opacity-60 h-tap w-tap items-center justify-center",
        disabled && "opacity-50",
      )}
    >
      <Icon name={icon} size="lg" color="ink" />
    </Pressable>
  );
}
