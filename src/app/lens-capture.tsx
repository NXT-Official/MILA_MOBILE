import { useLocalSearchParams } from "expo-router";

import { LensCaptureScreen } from "@/features/lens/LensCaptureScreen";
import { toLensMode } from "@/features/lens/modes";

export default function LensCapture() {
  // Which mode was chosen in the Lens sheet, and whether she asked for the
  // gallery instead of the shutter. Both are narrowed here so a hand-typed deep
  // link cannot hand the screen a mode that does not exist.
  const { mode, source } = useLocalSearchParams<{
    mode?: string;
    source?: string;
  }>();

  return (
    <LensCaptureScreen
      mode={toLensMode(mode)}
      source={source === "gallery" ? "gallery" : "camera"}
    />
  );
}
