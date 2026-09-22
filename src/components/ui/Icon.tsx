import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  CloudCheck,
  CloudOff,
  CloudRain,
  Coins,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  Image as ImageIcon,
  ImageOff,
  ImagePlus,
  Images,
  LayoutGrid,
  Link2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Mic,
  Moon,
  Palette,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Send,
  Settings,
  ShieldCheck,
  Shirt,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  SwitchCamera,
  Trash2,
  Truck,
  UserRound,
  Wand2,
  WifiOff,
  Wind,
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
  profile: UserRound,
  concierge: MessageCircle,
  settings: Settings,
  back: ArrowLeft,
  forward: ArrowRight,
  close: X,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  retry: RefreshCw,
  alert: AlertCircle,
  light: Sun,
  dark: Moon,
  coins: Coins,
  // Auth
  eye: Eye,
  eyeOff: EyeOff,
  secure: ShieldCheck,
  help: HelpCircle,
  feedback: MessageSquare,
  mail: Mail,
  signOut: LogOut,
  // Onboarding
  sparkle: Sparkles,
  bookmark: Bookmark,
  silhouette: Ruler,
  location: MapPin,
  saved: CloudCheck,
  unsaved: CloudOff,
  // Home. The five weather names match `ClimateIcon` exactly, so a forecast
  // maps to a glyph with no lookup table in between — one fewer place for the
  // two lists to drift apart.
  sun: Sun,
  cloud: Cloud,
  rain: CloudRain,
  snow: Snowflake,
  wind: Wind,
  outfit: Shirt,
  offline: WifiOff,
  // Lens. `gallery` is the single-frame glyph so it does not read as the Feed
  // tab's stack, which sits two controls away in the capture bar.
  gallery: ImageIcon,
  flipCamera: SwitchCamera,
  // Feed
  verified: BadgeCheck,
  /** The member profile's "Joined" line — the web's own CalendarDays glyph. */
  calendar: CalendarDays,
  lock: Lock,
  imageOff: ImageOff,
  link: Link2,
  external: ExternalLink,
  edit: Pencil,
  trash: Trash2,
  add: Plus,
  /** The style sheet's download control. */
  download: Download,
  /**
   * The shop rows' two extra glyphs. `star` is the only icon in the app that is
   * ever filled (`filled` prop) — the web fills the same star in its rating
   * row; everything else stays line-work at 1.75.
   */
  star: Star,
  truck: Truck,
  // Concierge
  send: Send,
  /** Opens the conversation list. The web's header glyph, kept verbatim so the
      two clients teach the same gesture — on mobile it presents a bottom sheet,
      never a side drawer (§3). */
  panel: PanelLeft,
  /** Marks a prompt that only fills the composer. */
  prompt: Wand2,
  attach: ImagePlus,
  mic: Mic,
} as const;

export type IconName = keyof typeof icons;

type IconProps = {
  name: IconName;
  size?: IconSize;
  color?: ColorToken;
  /**
   * A resolved colour string, for the one case a token cannot express: a
   * navigator has already computed the active/inactive tint and hands it to
   * `tabBarIcon`. Nothing else may use this — a feature passing a colour here
   * is inventing one outside the token system.
   */
  rawColor?: string;
  /** Omit for decorative icons — they are hidden from assistive tech. */
  label?: string;
  /**
   * Fills the glyph instead of stroking it. Exactly one intended use: the
   * rating `star`, which the web also fills (`strokeWidth={0}` + `fill`).
   * Everything else in the registry is line-work — the 1.75 stroke is the
   * identity both clients were designed around.
   */
  filled?: boolean;
};

/**
 * Standardises size, stroke width, theme colour resolution, and accessibility
 * in one place. Features import Icon; they never import lucide-react-native.
 *
 * Icons take a `color` prop rather than a className because lucide renders SVG
 * primitives that NativeWind classes do not reach.
 */
export function Icon({
  name,
  size = "md",
  color = "ink",
  rawColor,
  label,
  filled = false,
}: IconProps) {
  const Glyph = icons[name];
  const resolved = useThemeColor(color);

  return (
    <Glyph
      size={iconSizes[size]}
      strokeWidth={filled ? 0 : iconDefaults.strokeWidth}
      color={rawColor ?? resolved}
      fill={filled ? (rawColor ?? resolved) : "none"}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
    />
  );
}
