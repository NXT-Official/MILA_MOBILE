import { SEASONS, type DetailedColorProfile, type Season } from "@/constants/style-profile";

/**
 * The four-family palette every colour surface in Studio reads from.
 *
 * The persisted base column wins; the dossier's own season is the fallback for
 * a legacy reading that never wrote one. Never defaulted: showing a member with
 * no season a Summer palette is inventing her dossier, which is worse than
 * showing her nothing — so both the dossier and the try-on ask this one
 * question in one place and get the same answer.
 */
export function resolveSeasonFamily(
  seasonBase: string | null | undefined,
  dossier: DetailedColorProfile | null,
): Season | null {
  if ((SEASONS as readonly string[]).includes(seasonBase ?? "")) return seasonBase as Season;
  return dossier?.season ?? null;
}
