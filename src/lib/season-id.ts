import { SEASONS_MASTER_DATA, type SeasonKey } from "@/constants/style-profile";
import { migrateLegacySeason } from "@/lib/color-analysis/schemaMigration";
import type { SeasonId } from "@/lib/color-analysis/types";

/**
 * `profiles.color_profile.subSeason` stores the display form ("True Autumn");
 * the colour engine keys off the id form (`true_autumn`). The two differ only
 * by case and separator, so the conversion is mechanical — but it still has to
 * be *checked*, because an unrecognised season silently becoming a valid-looking
 * id is how a member gets someone else's palette.
 *
 * The input is not always a sub-season. `buildDashboardProfile` falls back to
 * the *base* season when `color_profile` carries no `subSeason`, so a member who
 * picked her season by hand rather than from a photo arrives here as "Autumn".
 * That is what `migrateLegacySeason` is for, and it is the module the web
 * already runs this through — mapping the four bases here instead of reusing it
 * is how the two clients end up disagreeing about who has a palette at all.
 *
 * Declared as a Record rather than an array so TypeScript rejects the file if
 * `SeasonId` ever gains a member and this list does not.
 */
const SEASON_IDS: Record<SeasonId, true> = {
  light_spring: true,
  warm_spring: true,
  true_spring: true,
  bright_spring: true,
  light_summer: true,
  cool_summer: true,
  true_summer: true,
  soft_summer: true,
  soft_autumn: true,
  warm_autumn: true,
  true_autumn: true,
  deep_autumn: true,
  bright_winter: true,
  cool_winter: true,
  true_winter: true,
  deep_winter: true,
};

/**
 * The third form, and the one every member on this client actually has.
 *
 * `ColorPath` writes the atelier's own label into `color_profile.subSeason`
 * ("Autumn Warm / True Autumn"), which is neither an id nor an engine display
 * name — so every one of them fell through to `null` and the daily palette
 * never rendered for anyone who picked a season by hand.
 *
 * Declared as a Record over `SeasonKey` so a new entry in `SEASONS_MASTER_DATA`
 * fails the build here rather than silently losing a palette again.
 */
const ATELIER_SEASON_IDS: Record<SeasonKey, SeasonId> = {
  SPRING_LIGHT: "light_spring",
  SPRING_TRUE: "true_spring",
  SPRING_BRIGHT: "bright_spring",
  SPRING_WARM: "warm_spring",
  SUMMER_LIGHT: "light_summer",
  SUMMER_TRUE: "true_summer",
  SUMMER_MUTED: "soft_summer",
  SUMMER_COOL: "cool_summer",
  AUTUMN_SOFT: "soft_autumn",
  AUTUMN_TRUE: "true_autumn",
  AUTUMN_DEEP: "deep_autumn",
  AUTUMN_WARM: "warm_autumn",
  WINTER_CLEAR: "bright_winter",
  WINTER_TRUE: "true_winter",
  WINTER_DEEP: "deep_winter",
  WINTER_COOL: "cool_winter",
};

const BY_ATELIER_LABEL = new Map(
  Object.entries(ATELIER_SEASON_IDS).map(([key, id]) => [
    SEASONS_MASTER_DATA[key as SeasonKey].subSeason.toLowerCase(),
    id,
  ]),
);

export function toSeasonId(season: string | null | undefined): SeasonId | null {
  if (typeof season !== "string" || !season.trim()) return null;

  const atelier = BY_ATELIER_LABEL.get(season.trim().replace(/\s+/g, " ").toLowerCase());
  if (atelier) return atelier;

  // `migrateLegacySeason` lowercases and trims, and maps a bare base season to
  // its true sub-season. Anything it does not recognise it returns unchanged,
  // which is why the membership check below still has to run: the web casts
  // that value straight to a SeasonId, and an invented id is worse than no
  // palette at all.
  const id = migrateLegacySeason(season).replace(/\s+/g, "_");
  return id in SEASON_IDS ? (id as SeasonId) : null;
}
