/**
 * The two Lens modes, verbatim from the web's Studio Lens drawer so the same
 * member reads the same words on both clients.
 *
 * The mode itself lives here rather than in the sheet because the capture
 * screen takes it as a prop and the route parses it out of a search param —
 * three files, one definition.
 */
export type LensMode = "analysis" | "dupe";

export const LENS_MODES: { id: LensMode; label: string }[] = [
  { id: "analysis", label: "Style Analysis" },
  { id: "dupe", label: "Dupe Hunter" },
];

export const LENS_COPY: Record<
  LensMode,
  {
    /** The sheet's headline, and the capture screen's header. */
    title: string;
    description: string;
    /** The capture card, and the action on the review step. */
    action: string;
    actionHint: string;
  }
> = {
  analysis: {
    title: "Show me the whole look",
    description:
      "Step back so I can see head to toe. I'll tell you what's singing and what to swap.",
    action: "Open camera & scan",
    actionHint: "Capture your outfit in real time for instant stylist analysis.",
  },
  dupe: {
    title: "Hunt the luxury dupe",
    description:
      "Snap an inspiration piece — designer bag, coat, shoe. I'll extract the silhouette and surface budget-friendly alternatives.",
    action: "Open camera & hunt",
    actionHint: "Capture the piece you want and Mila finds what looks like it for less.",
  },
};

/** Narrows the `mode` search param — anything else is the default mode. */
export function toLensMode(value: unknown): LensMode {
  return value === "dupe" ? "dupe" : "analysis";
}
