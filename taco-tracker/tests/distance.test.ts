import { describe, it, expect } from 'vitest'
import { haversineMeters, formatDistance } from '../scripts/lib/distance'

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(37.5665, 126.978, 37.5665, 126.978)).toBe(0)
  })

  it('approximates the Seoul → Busan distance (~325km)', () => {
    // Seoul Station -> Busan Station, roughly 325 km
    const m = haversineMeters(37.5547, 126.9707, 35.1156, 129.0419)
    expect(m).toBeGreaterThan(310_000)
    expect(m).toBeLessThan(340_000)
  })

  it('is symmetric', () => {
    const a = haversineMeters(37.5, 127.0, 37.6, 127.1)
    const b = haversineMeters(37.6, 127.1, 37.5, 127.0)
    expect(a).toBeCloseTo(b, 5)
  })
})

describe('formatDistance', () => {
  it('rounds meters under 1km', () => {
    expect(formatDistance(350)).toBe('350m')
    expect(formatDistance(999)).toBe('999m')
  })
  it('shows one decimal for km under 10', () => {
    expect(formatDistance(1200)).toBe('1.2km')
    expect(formatDistance(9499)).toBe('9.5km')
  })
  it('rounds km to integer at 10km+', () => {
    expect(formatDistance(12_400)).toBe('12km')
    expect(formatDistance(325_000)).toBe('325km')
  })
})
