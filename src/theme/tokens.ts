/**
 * Design tokens. The sRGB equivalents of the web's OKLCH values — React Native
 * has no oklch(). These must not drift from src/theme/global.css; the pairing
 * is asserted by __tests__/theme-tokens-test.ts.
 *
 * Consumed only by code that cannot take a className: navigator options,
 * bottom-sheet props, and the icon colour resolver. Everything else styles with
 * utility classes.
 */
export const colors = {
  light: {
    canvas: "#f5f0e8", // page background — "Paper Cream"
    surface: "#faf8f5", // cards, inputs, sheets — "Porcelain"
    surfaceAlt: "#f2eee9", // subtle fills
    ink: "#2b2320", // headings, primary fills — a warm brown-black
    body: "#6b6259", // body + secondary text — "Pencil"
    muted: "#6b6259", // same value by design
    accent: "#c9a96e", // Champagne Gold — accent ONLY
    accentSoft: "#f5ecd9", // hover / selected wash — "Champagne Veil"
    rose: "#d2a4a0", // contextual beauty warmth, NOT a second accent
    border: "#e8d5b0", // warm tan rule — never grey
    success: "#35794b",
    warning: "#c56c21",
    destructive: "#cc2827",
    onInk: "#faf8f5", // text on ink fills
    onDestructive: "#faf8f5",
    onWarning: "#1d140d",
  },
  dark: {
    canvas: "#110c09",
    surface: "#1b1612",
    surfaceAlt: "#29231e",
    ink: "#ebe7e2",
    body: "#b1a9a1",
    muted: "#a59d95",
    accent: "#c6ad8b",
    accentSoft: "#3b3121",
    rose: "#b88c87",
    border: "rgba(242,238,234,0.12)",
    success: "#57a26d",
    warning: "#df8f48",
    destructive: "#e24942",
    onInk: "#1a1511",
    onDestructive: "#faf8f5",
    onWarning: "#1a1511",
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)["light"];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 56,
} as const;

/**
 * Minimum touch targets (§10). `tap` is the WCAG 2.2 floor; `tile` is the
 * onboarding OptionTile, deliberately above it because a mis-tap there writes
 * the wrong silhouette to a member's profile.
 */
export const touchTargets = {
  tap: 44,
  tile: 56,
} as const;

/**
 * The floating tab bar's geometry, in one place because two files need to
 * agree on it: the bar draws itself from these, and the tab navigator's
 * `sceneStyle` pads every scene by `clearance` so scroll content stops above
 * the bar instead of ending underneath it.
 *
 * `clearance` excludes the safe-area inset — only the caller knows that.
 */
export const tabBar = {
  height: 74,
  /** Gap from the left, right, and bottom edges. */
  inset: 12,
  get clearance() {
    return this.height + this.inset * 2;
  },
} as const;

/** The five-step hierarchy maps to control size, never to taste. */
export const radii = {
  control: 12, // buttons, inputs, chips
  panel: 16, // list containers
  card: 20, // cards
  overlay: 24, // sheets, modals
  pill: 999,
} as const;

/**
 * Shadows are the one token group that cannot be a utility class: `elevation`
 * and `shadow*` are different native primitives. Apply via style={shadows.paper}
 * — this is case 1 of the StyleSheet exceptions.
 *
 * Float-Only Rule: if it does not overlap other content, it does not cast a
 * shadow — use a 1px border instead.
 * No-Nesting Rule: a shadowed surface never contains another shadowed surface.
 */
export const shadows = {
  paper: {
    shadowColor: "#2b2320",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#2b2320",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  nav: {
    shadowColor: "#2b2320",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
} as const;
