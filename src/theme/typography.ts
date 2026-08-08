/**
 * Bundled with expo-font — never fetched at runtime.
 *
 * Playfair sets headings, editorial headings, outfit names, and the occasional
 * pulled quote. It never sets body copy, UI labels, buttons, forms, or
 * navigation. Inter sets everything else and never sets an h1.
 */
export const fonts = {
  display: "PlayfairDisplay_700Bold",
  displayBold: "PlayfairDisplay_800ExtraBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
} as const;

export const type = {
  display: { family: fonts.displayBold, size: 40, lineHeight: 40, letterSpacing: -0.8 },
  h1: { family: fonts.display, size: 32, lineHeight: 34, letterSpacing: -0.64 },
  h2: { family: fonts.display, size: 26, lineHeight: 32, letterSpacing: -0.39 },
  h3: { family: fonts.display, size: 22, lineHeight: 28, letterSpacing: -0.22 },
  bodyLg: { family: fonts.body, size: 17, lineHeight: 27 },
  body: { family: fonts.body, size: 15, lineHeight: 24 },
  bodySm: { family: fonts.body, size: 13, lineHeight: 20 },
  label: {
    family: fonts.bodySemibold,
    size: 10,
    lineHeight: 14,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  section: {
    family: fonts.bodySemibold,
    size: 12,
    lineHeight: 16,
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  micro: { family: fonts.body, size: 11, lineHeight: 16 },
} as const;

/**
 * Body text honours the OS font scale to 1.3x. Display type is clamped — an
 * unbounded 200% scale turns a serif headline into a wall. Never set
 * allowFontScaling={false} on body copy.
 */
export const MAX_BODY_FONT_SCALE = 1.3;
export const MAX_DISPLAY_FONT_SCALE = 1.15;
