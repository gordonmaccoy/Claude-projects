import { describe, it, expect } from 'vitest'
import { isInsideBounds, type ViewportBounds } from '../scripts/lib/viewport-bounds'

const seoul: ViewportBounds = {
  swLat: 37.4,
  swLng: 126.8,
  neLat: 37.7,
  neLng: 127.2,
}

describe('isInsideBounds', () => {
  it('returns true for a point inside the box', () => {
    expect(isInsideBounds(37.55, 127.0, seoul)).toBe(true)
  })
  it('returns true for a point on the boundary', () => {
    expect(isInsideBounds(37.4, 126.8, seoul)).toBe(true)
    expect(isInsideBounds(37.7, 127.2, seoul)).toBe(true)
  })
  it('returns false for a point north of the box', () => {
    expect(isInsideBounds(37.8, 127.0, seoul)).toBe(false)
  })
  it('returns false for a point east of the box', () => {
    expect(isInsideBounds(37.55, 127.3, seoul)).toBe(false)
  })
})
