import { describe, it, expect } from 'vitest'
import { dedupeNeighborhoods } from '../lib/restaurants'

describe('dedupeNeighborhoods', () => {
  it('returns unique neighborhoods sorted ascending', () => {
    const rows = [
      { neighborhood: '용산구' },
      { neighborhood: '강남구' },
      { neighborhood: '용산구' },
      { neighborhood: '마포구' },
    ]
    expect(dedupeNeighborhoods(rows)).toEqual(['강남구', '마포구', '용산구'])
  })

  it('filters out null neighborhoods', () => {
    const rows = [
      { neighborhood: '용산구' },
      { neighborhood: null },
      { neighborhood: '강남구' },
    ]
    expect(dedupeNeighborhoods(rows)).toEqual(['강남구', '용산구'])
  })

  it('returns empty array for empty input', () => {
    expect(dedupeNeighborhoods([])).toEqual([])
  })

  it('returns empty array when all neighborhoods are null', () => {
    expect(dedupeNeighborhoods([{ neighborhood: null }, { neighborhood: null }])).toEqual([])
  })
})
