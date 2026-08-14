import type { SeasonId } from "@/lib/color-analysis/types";

/**
 * `profiles.color_profile.subSeason` stores the display form ("True Autumn");
 * the colour engine keys off the id form (`true_autumn`). The two differ only
 * by case and separator, so the conversion is mechanical — but it still has to
 * be *checked*, because an unrecognised season silently becoming a valid-looking
 * id is how a member gets someone else's palette.
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

export function toSeasonId(subSeason: string | null | undefined): SeasonId | null {
  if (typeof subSeason !== "string") return null;
  const id = subSeason.trim().toLowerCase().replace(/\s+/g, "_");
  return id in SEASON_IDS ? (id as SeasonId) : null;
}
