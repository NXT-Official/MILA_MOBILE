import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Images,
  LayoutGrid,
  MessageCircle,
  Moon,
  Palette,
  RefreshCw,
  Settings,
  Sun,
  X,
} from "lucide-react-native";

import { iconDefaults, iconSizes, type IconSize } from "@/theme/icons";
import { useThemeColor } from "@/theme/tailwind";
import type { ColorToken } from "@/theme/tokens";

/**
 * The registry is the allow-list. Only icons named here exist in Mila, and only
 * these get bundled — a wildcard re-export would pull in ~1500 icons.
 *
 * Adding one is a deliberate edit, which is also how the set stays coherent.
 */
export const icons = {
  home: LayoutGrid,
  feed: Images,
  camera: Camera,
  studio: Palette,
  concierge: MessageCircle,
  settings: Settings,
  back: ArrowLeft,
  close: X,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  retry: RefreshCw,
  alert: AlertCircle,
  light: Sun,
  dark: Moon,
} as const;

export type IconName = keyof typeof icons;

type IconProps = {
  name: IconName;
  size?: IconSize;
  color?: ColorToken;
  /** Omit for decorative icons — they are hidden from assistive tech. */
  label?: string;
};

/**
 * Standardises size, stroke width, theme colour resolution, and accessibility
 * in one place. Features import Icon; they never import lucide-react-native.
 *
 * Icons take a `color` prop rather than a className because lucide renders SVG
 * primitives that NativeWind classes do not reach.
 */
export function Icon({ name, size = "md", color = "ink", label }: IconProps) {
  const Glyph = icons[name];
  const resolved = useThemeColor(color);

  return (
    <Glyph
      size={iconSizes[size]}
      strokeWidth={iconDefaults.strokeWidth}
      color={resolved}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
    />
  );
}
