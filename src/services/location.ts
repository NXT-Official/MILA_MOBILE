import * as Location from "expo-location";

import { HUBS } from "@/constants/climate";

export type Hub = (typeof HUBS)[number];

export type NearestHubResult =
  | { status: "ok"; hub: Hub }
  | { status: "denied" }
  | { status: "unavailable" };

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance. A flat lat/lon difference would rank Stockholm closer
 * than Manila for a member in Singapore, because a degree of longitude is
 * ~111km at the equator and ~57km at Stockholm's latitude.
 */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestHub(coords: { lat: number; lon: number }): Hub {
  return HUBS.reduce((closest, hub) =>
    distanceKm(coords, hub) < distanceKm(coords, closest) ? hub : closest,
  );
}

/**
 * Foreground permission only, `Balanced` accuracy — a weather hub is a
 * ~100km decision, and asking for `Highest` would spin the GPS for nothing.
 *
 * Returns the nearest hub as a SUGGESTION. This function never saves: the
 * caller confirms with the member first (§7). A denial is a normal path, not an
 * error — the hub list still works, and nothing is logged.
 */
export async function suggestNearestHub(): Promise<NearestHubResult> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { status: "denied" };

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      status: "ok",
      hub: nearestHub({ lat: position.coords.latitude, lon: position.coords.longitude }),
    };
  } catch {
    // Location services off at the OS level, or no fix. Neither is worth an
    // error screen when there are ten hubs on the same page.
    return { status: "unavailable" };
  }
}
