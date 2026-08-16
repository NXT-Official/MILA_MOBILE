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

export function toSeasonId(season: string | null | undefined): SeasonId | null {
  if (typeof season !== "string" || !season.trim()) return null;
  // `migrateLegacySeason` lowercases and trims, and maps a bare base season to
  // its true sub-season. Anything it does not recognise it returns unchanged,
  // which is why the membership check below still has to run: the web casts
  // that value straight to a SeasonId, and an invented id is worse than no
  // palette at all.
  const id = migrateLegacySeason(season).replace(/\s+/g, "_");
  return id in SEASON_IDS ? (id as SeasonId) : null;
}
