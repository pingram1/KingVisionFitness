import { haversineMeters } from '../geo';

// Reference distances pulled from independent calculators (Movable Type
// Haversine + Google Maps). Each expectation has a fuzz tolerance because
// Haversine's spherical-earth assumption diverges from real geoids by ~0.3%.

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(0, 0, 0, 0)).toBe(0);
    expect(haversineMeters(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('one degree of latitude is ~111.195 km at the equator', () => {
    const meters = haversineMeters(0, 0, 1, 0);
    expect(meters).toBeGreaterThan(111_000);
    expect(meters).toBeLessThan(111_400);
  });

  it('NYC → LA is ~3,936 km within 1% tolerance', () => {
    const nyc = { lat: 40.7128, lon: -74.006 };
    const la = { lat: 34.0522, lon: -118.2437 };
    const meters = haversineMeters(nyc.lat, nyc.lon, la.lat, la.lon);
    const expected = 3_936_000;
    expect(Math.abs(meters - expected) / expected).toBeLessThan(0.01);
  });

  it('a 100m walk north of a check-in stays under the default 100m radius near its boundary', () => {
    // 0.0009 degrees latitude is ~100m. Should be ≤ 100m.
    const meters = haversineMeters(34.0522, -118.2437, 34.05308998, -118.2437);
    expect(meters).toBeGreaterThan(98);
    expect(meters).toBeLessThan(102);
  });

  it('is symmetric and commutative', () => {
    const ab = haversineMeters(34.0522, -118.2437, 40.7128, -74.006);
    const ba = haversineMeters(40.7128, -74.006, 34.0522, -118.2437);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it('respects the antimeridian by giving the shortest great-circle distance', () => {
    // 179°E and -179°E (= 181°E equivalent) are 2° apart, not 358°.
    const meters = haversineMeters(0, 179, 0, -179);
    // ~222 km at the equator (2° longitude).
    expect(meters).toBeGreaterThan(220_000);
    expect(meters).toBeLessThan(225_000);
  });

  it('handles polar points without NaN', () => {
    const meters = haversineMeters(89.999, 0, 89.999, 180);
    expect(Number.isFinite(meters)).toBe(true);
    expect(meters).toBeGreaterThan(0);
    expect(meters).toBeLessThan(500); // ~110m apart at the pole
  });

  it('produces finite numbers across the full coordinate range', () => {
    const samples: Array<[number, number, number, number]> = [
      [-90, -180, 90, 180],
      [45, 0, -45, 0],
      [12.34, 56.78, -12.34, -56.78],
    ];
    for (const [a, b, c, d] of samples) {
      expect(Number.isFinite(haversineMeters(a, b, c, d))).toBe(true);
    }
  });
});
