export interface ViewportBounds {
  swLat: number
  swLng: number
  neLat: number
  neLng: number
}

/**
 * True if (lat, lng) is inside the given bounds (inclusive).
 * The bounding box is assumed not to cross the antimeridian — fine for Seoul.
 */
export function isInsideBounds(
  lat: number,
  lng: number,
  b: ViewportBounds
): boolean {
  return lat >= b.swLat && lat <= b.neLat && lng >= b.swLng && lng <= b.neLng
}
