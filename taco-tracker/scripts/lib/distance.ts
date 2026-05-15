/**
 * Haversine great-circle distance between two lat/lng points, in meters.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000 // Earth's mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Format a distance in meters to a short human string:
 *  < 1000 m  -> "350m"
 *  < 10 km   -> "1.2km"
 *  >= 10 km  -> "12km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  const km = meters / 1000
  if (km < 10) return `${km.toFixed(1)}km`
  return `${Math.round(km)}km`
}
