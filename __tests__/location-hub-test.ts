import { HUBS } from "@/constants/climate";
import { distanceKm, nearestHub } from "@/services/location";

/**
 * The device-location path picks a hub by great-circle distance. A flat lat/lon
 * comparison would look right in testing from Manila and put a member in
 * Stockholm on the wrong side of the planet, because a degree of longitude is
 * ~111km at the equator and ~57km at Stockholm's latitude.
 */

const CITY = {
  quezonCity: { lat: 14.68, lon: 121.04 },
  johorBahru: { lat: 1.49, lon: 103.76 },
  brooklyn: { lat: 40.68, lon: -73.94 },
  reading: { lat: 51.46, lon: -0.97 },
  osaka: { lat: 34.69, lon: 135.5 },
  busan: { lat: 35.18, lon: 129.08 },
  abuDhabi: { lat: 24.45, lon: 54.38 },
  oslo: { lat: 59.91, lon: 10.75 },
};

describe("distanceKm", () => {
  it("is zero for a point against itself", () => {
    expect(distanceKm(CITY.brooklyn, CITY.brooklyn)).toBeCloseTo(0, 6);
  });

  it("is symmetric", () => {
    const manila = HUBS.find((h) => h.id === "manila")!;
    const london = HUBS.find((h) => h.id === "london")!;
    expect(distanceKm(manila, london)).toBeCloseTo(distanceKm(london, manila), 6);
  });

  it("matches known great-circle distances within 1%", () => {
    const london = HUBS.find((h) => h.id === "london")!;
    const nyc = HUBS.find((h) => h.id === "nyc")!;
    const tokyo = HUBS.find((h) => h.id === "tokyo")!;
    // London–New York is ~5570km; London–Tokyo is ~9560km.
    expect(distanceKm(london, nyc)).toBeGreaterThan(5510);
    expect(distanceKm(london, nyc)).toBeLessThan(5630);
    expect(distanceKm(london, tokyo)).toBeGreaterThan(9460);
    expect(distanceKm(london, tokyo)).toBeLessThan(9660);
  });

  it("does not treat a degree of longitude as a fixed distance", () => {
    // One degree of longitude at Singapore's latitude is nearly double what it
    // is at Stockholm's. A naive sqrt(dLat² + dLon²) would score these equal.
    const atEquator = distanceKm({ lat: 1.35, lon: 103.82 }, { lat: 1.35, lon: 104.82 });
    const atStockholm = distanceKm({ lat: 59.33, lon: 18.07 }, { lat: 59.33, lon: 19.07 });
    expect(atEquator).toBeGreaterThan(atStockholm * 1.8);
  });
});

describe("nearestHub", () => {
  it.each([
    [CITY.quezonCity, "manila"],
    [CITY.johorBahru, "singapore"],
    [CITY.brooklyn, "nyc"],
    [CITY.reading, "london"],
    [CITY.osaka, "tokyo"],
    [CITY.busan, "seoul"],
    [CITY.abuDhabi, "dubai"],
    [CITY.oslo, "stockholm"],
  ])("picks the right hub for %p", (coords, expected) => {
    expect(nearestHub(coords).id).toBe(expected);
  });

  it("returns each hub for its own coordinates", () => {
    for (const hub of HUBS) {
      expect(nearestHub({ lat: hub.lat, lon: hub.lon }).id).toBe(hub.id);
    }
  });

  it("always returns a hub, even from the middle of an ocean", () => {
    expect(HUBS).toContain(nearestHub({ lat: -40, lon: -140 }));
  });

  it("handles the antimeridian without picking the far side of the world", () => {
    // Just west of the date line, north Pacific: Tokyo is the closest hub, and
    // a longitude-difference shortcut that ignores the wrap picks Stockholm.
    expect(nearestHub({ lat: 40, lon: 179 }).id).toBe("tokyo");
    expect(nearestHub({ lat: 40, lon: -179 }).id).toBe("tokyo");
  });
});
