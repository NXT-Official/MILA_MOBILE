import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge does not know Mila's custom class groups, so without this
 * cn("rounded-card", "rounded-pill") keeps both and whichever lands later in
 * the stylesheet wins arbitrarily.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ["control", "panel", "card", "overlay", "pill"] }],
      "font-size": [{ text: ["micro", "label", "section", "h3", "h2", "h1", "display"] }],
      tracking: [{ tracking: ["display", "heading", "label", "section"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
