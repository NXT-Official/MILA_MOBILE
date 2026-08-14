import { PhasePlaceholder } from "@/components/feedback/PhasePlaceholder";

/**
 * Never actually reached: the tab listener in `(tabs)/_layout.tsx` intercepts
 * the press and pushes `/lens-capture` full-screen instead. The file exists
 * because the navigator declares five tabs and the router throws without it.
 */
export default function Lens() {
  return (
    <PhasePlaceholder
      icon="camera"
      title="Lens arrives in Phase 06"
      description="Point the camera at an outfit and Mila scores it against your palette."
    />
  );
}
