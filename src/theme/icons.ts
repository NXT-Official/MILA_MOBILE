export const iconSizes = {
  xs: 14, // dense metadata, inline with micro text
  sm: 18, // inside inputs, chips, list rows
  md: 22, // default — buttons, tab bar
  lg: 28, // empty states, section headers
  xl: 36, // hero / permission screens
} as const;

export const iconDefaults = {
  /**
   * The editorial weight — do not raise it. 2 reads as a generic app; 1
   * disappears at xs. Overridable only inside components/ui, never a feature.
   */
  strokeWidth: 1.75,
} as const;

export type IconSize = keyof typeof iconSizes;
