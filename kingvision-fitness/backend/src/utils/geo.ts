// Pure geo helpers — no Mongoose, no Express. Kept dependency-free so unit
// tests can exercise the math without booting the rest of the server.

const EARTH_RADIUS_METERS = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two WGS-84 coordinates, in meters.
 *
 * Uses the Haversine formula. Returns 0 for identical points. Inputs must be
 * finite numbers; out-of-range latitudes/longitudes are tolerated mathematically
 * but should be rejected at the API boundary (see `checkInBodySchema`).
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
