import { climateForWeatherCode, HUBS, type ClimateState } from "@/constants/climate";

/**
 * Open-Meteo. No key, no auth, no account — which is the whole reason it is the
 * weather source: a keyed provider would put a secret in the bundle (§10).
 *
 * The member's hub is the only input. Device coordinates are never sent here;
 * `services/location.ts` resolves them to a hub locally and the hub is what
 * travels, so a third party never receives a member's position.
 */
const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 10_000;

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
};

export function hubById(hubId: string | null | undefined) {
  return HUBS.find((hub) => hub.id === hubId) ?? null;
}

export async function fetchHubWeather(hubId: string): Promise<ClimateState> {
  const hub = hubById(hubId);
  if (!hub) throw new Error(`Unknown weather hub: ${hubId}`);

  const url =
    `${ENDPOINT}?latitude=${hub.lat}&longitude=${hub.lon}` +
    "&current=temperature_2m,weather_code,wind_speed_10m" +
    "&temperature_unit=celsius&wind_speed_unit=kmh";

  // Open-Meteo has no SLA. Without a deadline a stalled socket leaves the
  // widget in its loading skeleton until the screen unmounts.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let payload: OpenMeteoResponse;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
    payload = (await res.json()) as OpenMeteoResponse;
  } finally {
    clearTimeout(timer);
  }

  const current = payload.current;
  // A 200 with no `current` block is a malformed answer, not a temperature of
  // zero. Throwing routes it to the same degraded copy as a network failure.
  if (typeof current?.temperature_2m !== "number" || typeof current.weather_code !== "number") {
    throw new Error("Weather response was missing today's reading.");
  }

  const tempC = Math.round(current.temperature_2m);
  const weather = climateForWeatherCode(current.weather_code, current.wind_speed_10m ?? 0);

  return {
    label: weather.description,
    location: hub.city,
    icon: weather.icon,
    tempC,
    tempF: Math.round((tempC * 9) / 5 + 32),
    condition: weather.condition,
  };
}
