import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Backpack,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
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
  createLucideIcon,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Gem,
  Glasses,
  Handbag,
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
  Search,
  Send,
  Settings,
  ShieldCheck,
  Shirt,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  SwitchCamera,
  Tag,
  Trash2,
  Truck,
  UserRound,
  Wand2,
  Watch,
  WifiOff,
  Wind,
  X,
} from "lucide-react-native";

import { iconDefaults, iconSizes, type IconSize } from "@/theme/icons";
import { useThemeColor } from "@/theme/tailwind";
import type { ColorToken } from "@/theme/tokens";

import { garmentGlyphs } from "./garment-glyphs";

/**
 * The `@lucide/lab` garment glyphs (data in `./garment-glyphs`), built with
 * lucide's own factory so they take the same props as every icon below. Built
 * here because this is the one file allowed to import the icon library.
 * The copied data is ISC-licensed (c) Lucide Icons and Contributors; the full
 * notice sits at the top of `./garment-glyphs`, as the licence requires.
 *
 * // src: lucide-react-native 1.30.0 · dist/types/lucide-react-native.d.ts:
 * //   createLucideIcon(iconName: string, iconNode: IconNode)
 */
const Trousers = createLucideIcon("trousers", garmentGlyphs.trousers);
const Shorts = createLucideIcon("shorts", garmentGlyphs.shorts);
const Skirt = createLucideIcon("skirt", garmentGlyphs.skirt);
const Dress = createLucideIcon("dress", garmentGlyphs.dress);
const Jacket = createLucideIcon("jacket", garmentGlyphs.jacket);
const Vest = createLucideIcon("vest", garmentGlyphs.vest);
const Sneaker = createLucideIcon("sneaker", garmentGlyphs.sneaker);
const HighHeel = createLucideIcon("high-heel", garmentGlyphs.highHeel);
const Socks = createLucideIcon("socks", garmentGlyphs.socks);
const Belt = createLucideIcon("belt", garmentGlyphs.belt);
const Scarf = createLucideIcon("scarf", garmentGlyphs.scarf);
const HatBowler = createLucideIcon("hat-bowler", garmentGlyphs.hatBowler);
const GemRing = createLucideIcon("gem-ring", garmentGlyphs.gemRing);

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
  // History
  search: Search,
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
  // Saved pieces. `bookmark` (above) is the unsaved state of the save toggle;
  // the check is the saved state, so the state is carried by shape, not hue.
  bookmarkCheck: BookmarkCheck,
  /**
   * Garments — the recommended-piece badge. Named for the drawing, and exactly
   * the `GarmentIcon` names in `lib/garment-label.ts`, so a label maps to a
   * glyph with no lookup table between them. The lucide-react-native set has
   * no trousers, skirt or heel; those come from `./garment-glyphs`, copied
   * from `@lucide/lab` and built with lucide's own factory.
   */
  shirt: Shirt,
  trousers: Trousers,
  shorts: Shorts,
  skirt: Skirt,
  dress: Dress,
  jacket: Jacket,
  vest: Vest,
  sneaker: Sneaker,
  heel: HighHeel,
  socks: Socks,
  belt: Belt,
  scarf: Scarf,
  hat: HatBowler,
  handbag: Handbag,
  backpack: Backpack,
  gem: Gem,
  ring: GemRing,
  watch: Watch,
  sunglasses: Glasses,
  tag: Tag,
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
