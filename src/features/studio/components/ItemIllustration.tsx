import Svg, { Circle, Path } from "react-native-svg";

import { useThemeColor } from "@/theme/tailwind";

/**
 * Line drawings for the named things a styling note points at — the "wrap
 * dresses" or "chiffon" a member may have heard of but could not picture.
 *
 * The terms are a fixed, enumerable set (dna.ts), so the library is static:
 * nothing here is generated per member. Colours and metals are deliberately
 * absent — their swatch IS the illustration, and it comes from palette data.
 *
 * ponytail: inline paths rather than image assets, like `AttributeDiagram`.
 * They take their stroke from a theme token (so they theme for free) and add
 * no files to the bundle. The coverage test fails when dna.ts grows an item
 * that has neither a colour nor a drawing.
 */

type ItemDrawing = {
  paths: string[];
  /** Filled dots — knots, grain, sparkles. [cx, cy, r] in viewBox units. */
  dots?: [number, number, number][];
};

export const ITEM_ILLUSTRATIONS: Record<string, ItemDrawing> = {
  // Silhouette strategy — the named pieces, keyed by the item terms in dna.ts.
  "Wrap dresses": {
    paths: [
      "M7.5 5 H16.5 L18.8 11 L21.6 28 H2.4 L5.2 11 Z",
      "M10.4 5 Q12 7.2 13.6 5",
      "M10.8 5.8 L14.4 10.4",
      "M13.2 5.8 L9.6 10.2",
    ],
    dots: [[12.1, 11.4, 0.8]],
  },
  "Belted knits": {
    paths: [
      "M8 6 H16 L19.4 11.4 L17.6 13.4 L15.6 11.2 V26.5 H8.4 V11.2 L6.4 13.4 L4.6 11.4 Z",
      "M7.5 16.2 H16.5",
      "M7.5 18.6 H16.5",
      "M11 16.2 h2 v2.4 h-2 z",
    ],
  },
  "Vertical lines": {
    paths: [
      "M8.6 5.2 H15.4 L18 28 H6 Z",
      "M10 5.2 L12 7.4 L14 5.2",
      "M10.7 8.8 V27",
      "M13.3 8.8 V27",
    ],
  },
  "Peplum": {
    paths: [
      "M8.6 6 H15.4 L17 10.4 V14 H7 V10.4 Z",
      "M10.4 6 Q12 8 13.6 6",
      "M7 14 C10.4 13.1 13.6 13.1 17 14 L19.6 20.4 C14.8 18.7 9.2 18.7 4.4 20.4 Z",
    ],
  },
  "Pleats": {
    paths: [
      "M8 8 H16 L19.6 28 H4.4 Z",
      "M9.7 9.2 L8.3 27",
      "M12 9.2 V27",
      "M14.3 9.2 L15.7 27",
    ],
  },
  "A defined waist": {
    paths: [
      "M9 5 H15 L17.6 10.6 Q16 13.6 17.6 16.6 L19.6 27 H4.4 L6.4 16.6 Q8 13.6 6.4 10.6 Z",
      "M7.5 13.9 H16.5",
      "M11.3 12.9 h1.6 v2 h-1.6 z",
    ],
  },
  "Statement necklines": {
    paths: [
      "M6.8 7 H17.2 L19.2 12.6 V26 H4.8 V12.6 Z",
      "M7.8 7 Q12 10.8 16.2 7",
    ],
  },
  "Structured tops": {
    paths: [
      "M7 6 H17 L19.4 9.6 V26 H4.6 V9.6 Z",
      "M9.4 6 L12 10.6 L14.6 6",
      "M12 10.6 V26",
    ],
    dots: [[12, 14, 0.55], [12, 17, 0.55]],
  },
  "Soft lower volume": {
    paths: [
      "M8.6 8 H15.4 C17 14 17.4 20 18 25.6 Q15 27 12 26.4 Q9 25.8 6 25.6 C6.6 20 7 14 8.6 8 Z",
      "M12 9.6 Q11.4 17 11.6 25.2",
    ],
  },
  "V-necks": {
    paths: [
      "M7 7 H17 L19 12.4 V26 H5 V12.4 Z",
      "M9.2 7 L12 14 L14.8 7",
    ],
  },
  "A-line skirts": {
    paths: [
      "M8.6 8 H15.4 L19.8 27 H4.2 Z",
      "M8.2 10.4 H15.8",
    ],
  },
  "Wide-leg denim": {
    paths: [
      "M7.4 7 H16.6 L18 12 L20.2 29 H14 L12 17.2 L10 29 H3.8 L6 12 Z",
      "M12 7 V16.2",
      "M7.7 9.5 H16.3",
    ],
  },
  "Open necklines": {
    paths: [
      "M7 7 H17 L19 12.6 V26 H5 V12.6 Z",
      "M8.4 7 Q12 13.6 15.6 7",
    ],
  },
  "Empire waists": {
    paths: [
      "M8.6 5 H15.4 L17.6 12.4 Q17.8 13.6 18.2 14.6 L21 28 H3 L5.8 14.6 Q6.2 13.6 6.4 12.4 Z",
      "M6.6 13.2 Q12 12 17.4 13.2",
      "M10.2 5 Q12 7.2 13.8 5",
    ],
  },
  "Straight trousers": {
    paths: [
      "M7.4 7 H16.6 L17.2 11.4 L16.6 29 H13.2 L12 15 L10.8 29 H7.4 L6.8 11.4 Z",
      "M7.8 9.5 H16.2",
      "M12 9.5 V14.6",
    ],
  },

  // Hair direction — the styling moves.
  "Precision cuts": {
    paths: [
      "M6.9 17.4 V9 Q6.9 5 12 5 Q17.1 5 17.1 9 V17.4",
      "M7.1 9.6 H16.9",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
    ],
  },
  "Blunt ends": {
    paths: [
      "M8.2 5.8 Q12 4 15.8 5.8 L16.6 21 H7.4 Z",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
      "M7.9 19.4 H16.1",
    ],
  },
  "Glossy finishes": {
    paths: [
      "M8.2 5.8 Q12 4 15.8 5.8 L16.2 20.4 Q12 22 7.8 20.4 Z",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
      "M9 7.8 L14 10.6",
      "M9.8 11.4 L12.4 12.8",
      "M16.4 6.8 h2.6 M17.7 5.5 v2.6",
    ],
  },
  "Mid-length shapes": {
    paths: [
      "M8.4 5.8 Q12 4 15.6 5.8 Q16.6 10.4 16 15.6 Q13.9 17.2 12 16.8 Q10.1 16.4 8 15.6 Q7.4 10.4 8.4 5.8 Z",
      "M9.2 12.2 Q9.2 15.4 12 15.4 Q14.8 15.4 14.8 12.2",
      "M6.4 19.6 Q9.3 17.8 12 17.8 Q14.7 17.8 17.6 19.6",
    ],
  },
  "Soft internal layers": {
    paths: [
      "M8 5.6 Q12 3.8 16 5.6 Q17.2 11.4 16.6 20 Q14.1 22.2 12 21.6 Q9.9 21 7.4 20 Q6.8 11.4 8 5.6 Z",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
      "M9.8 9.4 Q8.6 14.6 8.2 20.2 Q8 22 9.4 22.6",
      "M14.2 9.4 Q15.4 14.6 15.8 20.2 Q16 22 14.6 22.6",
    ],
  },
  "Sea-salt texture": {
    paths: [
      "M8.4 6 Q12 4.2 15.6 6 Q17.4 10 15.4 13.4 Q17 16.8 15.6 20 Q12 21.6 8.4 20 Q7 16.8 8.6 13.4 Q6.6 10 8.4 6 Z",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
    ],
    dots: [[7.4, 9.6, 0.55], [16.4, 10.8, 0.55], [8.8, 16.8, 0.55], [15, 18, 0.55]],
  },
  "Curl-defined styling": {
    paths: [
      "M8.2 5.6 Q12 3.6 15.8 5.6 Q18.6 9.6 16.2 13 Q18.4 16.4 16.2 19.6 Q13.9 21.6 12 21.2 Q10.1 20.8 7.8 19.6 Q5.6 16.4 7.8 13 Q5.4 9.6 8.2 5.6 Z",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
      "M9.6 20.6 q2.4 1.8 4.8 0",
    ],
  },
  "Weight left in": {
    paths: [
      "M8.4 5.8 Q12 4 15.6 5.8 L16.8 20.8 Q12 22.6 7.2 20.8 Z",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
      "M9.6 9.4 L9 19.6",
      "M14.4 9.4 L15 19.6",
    ],
  },
  "Shape trims": {
    paths: [
      "M8.2 5.8 Q12 4 15.8 5.8 Q17 11.6 16.2 17.6 Q14 19.6 12 19 Q10 18.4 7.8 17.6 Q7 11.6 8.2 5.8 Z",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
      "M14.6 19.6 L17.4 25.4",
      "M18 19.6 L15.2 25.4",
    ],
    dots: [[14.2, 27, 1], [18.4, 27, 1]],
  },
  "Sculpted volume": {
    paths: [
      "M8 16.2 Q5.4 11 8.6 7 Q12 3.4 15.4 7 Q18.6 11 16 16.2 Q12 18.4 8 16.2 Z",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
      "M8.8 9.8 Q12 7.6 15.2 9.8",
      "M9.4 13 Q12 11.6 14.6 13",
    ],
  },
  "Protective silhouettes": {
    paths: [
      "M8.4 8.6 a3.6 3.6 0 1 0 7.2 0 a3.6 3.6 0 1 0 -7.2 0",
      "M9.2 12.6 Q9.2 16 12 16 Q14.8 16 14.8 12.6",
      "M8.4 12.4 Q7.6 14.6 8 16.6",
      "M15.6 12.4 Q16.4 14.6 16 16.6",
    ],
  },
  "Light-catching finishes": {
    paths: [
      "M8.2 5.8 Q12 4 15.8 5.8 L16.2 20.2 Q12 22.2 7.8 20.2 Z",
      "M9.2 12.2 Q9.2 15.6 12 15.6 Q14.8 15.6 14.8 12.2",
      "M9.6 7.6 h3 M11.1 6.1 v3",
      "M15.2 12 h2.6 M16.5 10.7 v2.6",
      "M8.2 15.8 h2.2 M9.3 14.7 v2.2",
    ],
  },

  // Textile direction — the fabrics. The metals are absent on purpose: their colour
  // comes from palette data and renders as a swatch, not a drawing.
  "Fine cottons": {
    paths: [
      "M5.6 7 H18.4 V23.4 Q12 26.6 5.6 23.4 Z",
      "M8.8 9.6 V24.2",
      "M12 9.6 V25.4",
      "M15.2 9.6 V24.2",
      "M6.4 12.8 H17.6",
      "M6.3 16.2 H17.7",
      "M6.4 19.6 H17.6",
    ],
  },
  "Chiffon": {
    paths: [
      "M5.4 7.4 Q8.6 5.2 11.8 6.9 Q15 8.6 18.4 6.6 Q19.8 13.2 18.4 20.6 Q15 22.4 12 21 Q9 19.6 5.6 21.4 Q4.2 13.8 5.4 7.4 Z",
      "M9.3 10.4 Q12.3 13 9.7 16.2 Q8.8 18.4 10.3 20.2",
      "M14.5 10.8 Q16.5 13.2 14.3 16",
    ],
  },
  "Silk crepe": {
    paths: [
      "M5.6 7 H18.4 V23.4 Q12 26.6 5.6 23.4 Z",
      "M8.4 10.8 Q7.9 15.8 8.8 20.6",
    ],
    dots: [
      [8, 10, 0.55],
      [10.6, 10.8, 0.55],
      [13.2, 10.4, 0.55],
      [15.8, 11.2, 0.55],
      [9.4, 13.6, 0.55],
      [12, 14.2, 0.55],
      [14.6, 13.8, 0.55],
      [16.6, 15.4, 0.55],
      [10.2, 17.2, 0.55],
      [12.8, 17.8, 0.55],
      [15.2, 17.4, 0.55],
      [9, 20, 0.55],
      [11.6, 20.8, 0.55],
      [14.2, 20.4, 0.55],
    ],
  },
  "Brushed wool": {
    paths: [
      "M5.6 7 H18.4 V23.4 Q12 26.6 5.6 23.4 Z",
      "M6.8 6.7 l-1 -1.9",
      "M9.4 6.4 l-.6 -2.1",
      "M12 6.3 v-2.2",
      "M14.6 6.4 l.6 -2.1",
      "M17.2 6.7 l1 -1.9",
      "M5.5 12.5 h-1.7",
      "M5.5 15.5 h-1.7",
      "M5.5 18.5 h-1.7",
      "M18.5 12.5 h1.7",
      "M18.5 15.5 h1.7",
      "M18.5 18.5 h1.7",
      "M7 13.4 Q12 15.4 17 13.4",
      "M7 17.8 Q12 19.6 17 17.8",
    ],
  },
  "Matte satin": {
    paths: [
      "M5.6 7 H18.4 V23.4 Q12 26.6 5.6 23.4 Z",
      "M8.8 9.6 Q7.4 15 9 20.6",
      "M11.2 9.6 Q9.8 15 11.4 20.6",
      "M15.2 9.6 Q16.6 15 15 20.6",
      "M12.8 9.6 Q14.2 15 12.6 20.6",
      "M7.4 21.6 Q12 23.6 16.6 21.6",
    ],
  },
  "Suede": {
    paths: [
      "M5.6 7 H18.4 V23.4 Q12 26.6 5.6 23.4 Z",
    ],
    dots: [
      [8, 12, 0.5],
      [10.8, 11.4, 0.5],
      [13.6, 12.2, 0.5],
      [16.2, 13.8, 0.5],
      [9.2, 15.6, 0.5],
      [12, 16.4, 0.5],
      [14.8, 17, 0.5],
      [8.4, 19.2, 0.5],
      [11.2, 20.2, 0.5],
      [14.4, 20.6, 0.5],
    ],
  },
  "Tweed": {
    paths: [
      "M5.6 7 H18.4 V23.4 Q12 26.6 5.6 23.4 Z",
      "M7.6 11 l1.9 1.9",
      "M12 10.6 l1.9 1.9",
      "M16.2 11.4 l1.2 1.2",
      "M9.8 14.8 l1.9 1.9",
      "M14.2 14.4 l1.9 1.9",
      "M7.8 18.8 l1.9 1.9",
      "M12.4 19.2 l1.4 1.4",
      "M16.4 18.4 l1.1 1.1",
    ],
  },
  "Brushed leather": {
    paths: [
      "M5.4 7.4 H18.6 L18.2 23.6 Q12 26.6 6 23.2 Z",
      "M5.7 9.4 H18.3",
    ],
    dots: [[8.6, 12.4, 0.55], [13.8, 12.8, 0.55], [10.6, 16.2, 0.55], [15, 16.8, 0.55]],
  },
  "Structured wool": {
    paths: [
      "M5.8 7 H18.2 V24 L12 21.4 L5.8 24 Z",
      "M12 7.4 V21.4",
    ],
  },
  "Mirror-finish silk": {
    paths: [
      "M5.6 7 H18.4 V23.4 Q12 26.6 5.6 23.4 Z",
      "M7.2 19.8 L10.6 9.4",
      "M10.4 21 L13.8 10.6",
      "M15.6 11.6 h2.6 M16.9 10.3 v2.6",
    ],
  },
};

/**
 * One item's drawing, at row size (`sm`) or in the detail sheet (`lg`).
 * Renders nothing for a term without a drawing — a colour item, or a term
 * newer than this file — so a missing one never breaks the row it sits in.
 *
 * Decorative: the term and its definition sit right beside it, so this is
 * hidden from assistive tech.
 */
export function ItemIllustration({ term, size = "sm" }: { term: string; size?: "sm" | "lg" }) {
  const stroke = useThemeColor("body");
  const drawing = ITEM_ILLUSTRATIONS[term];
  if (!drawing) return null;

  const width = size === "lg" ? 104 : 36;
  const height = Math.round((width * 32) / 24);

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 32"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {drawing.paths.map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {drawing.dots?.map(([cx, cy, r]) => (
        <Circle key={`${cx},${cy},${r}`} cx={cx} cy={cy} r={r} fill={stroke} />
      ))}
    </Svg>
  );
}
