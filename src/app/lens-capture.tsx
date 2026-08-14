import { PhasePlaceholder } from "@/components/feedback/PhasePlaceholder";

export default function LensCapture() {
  return (
    <PhasePlaceholder
      icon="camera"
      title="Lens arrives in Phase 06"
      description="Point the camera at an outfit and Mila scores it against your palette."
      onBack
    />
  );
}
