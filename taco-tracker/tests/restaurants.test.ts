import { describe, it, expect } from 'vitest'
import { dedupeNeighborhoods, buildRestaurantsQuery } from '../lib/restaurants'

interface MockQuery {
  eqCalls: Array<[string, unknown]>
  inCalls: Array<[string, unknown[]]>
  overlapsCalls: Array<[string, unknown[]]>
  orCalls: string[]
  orderCalls: Array<[string, { ascending: boolean }]>
  returnsCalls: number
}

function mockQuery() {
  const m: MockQuery = {
    eqCalls: [],
    inCalls: [],
    overlapsCalls: [],
    orCalls: [],
    orderCalls: [],
    returnsCalls: 0,
  }
  const q: any = {
    eq: (col: string, v: unknown) => { m.eqCalls.push([col, v]); return q },
    in: (col: string, v: unknown[]) => { m.inCalls.push([col, v]); return q },
    overlaps: (col: string, v: unknown[]) => { m.overlapsCalls.push([col, v]); return q },
    or: (expr: string) => { m.orCalls.push(expr); return q },
    order: (col: string, opts: { ascending: boolean }) => { m.orderCalls.push([col, opts]); return q },
    returns: () => { m.returnsCalls++; return q },
    select: () => q,
    from: () => q,
    _m: m,
  }
  return q
}

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

describe('buildRestaurantsQuery', () => {
  it('always filters by status and orders by name_ko ascending', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live' })
    expect(q._m.eqCalls).toContainEqual(['status', 'live'])
    expect(q._m.orderCalls).toContainEqual(['name_ko', { ascending: true }])
  })

  it('adds .in for neighborhoods array', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', neighborhoods: ['용산구', '마포구'] })
    expect(q._m.inCalls).toContainEqual(['neighborhood', ['용산구', '마포구']])
  })

  it('does not add .in when neighborhoods is empty', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', neighborhoods: [] })
    expect(q._m.inCalls).toEqual([])
  })

  it('does not add .in when neighborhoods is undefined', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live' })
    expect(q._m.inCalls).toEqual([])
  })

  it('adds .overlaps for dishes array', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', dishes: ['taco', 'burrito'] })
    expect(q._m.overlapsCalls).toContainEqual(['dish_tags', ['taco', 'burrito']])
  })

  it('does not add .overlaps when dishes is empty', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', dishes: [] })
    expect(q._m.overlapsCalls).toEqual([])
  })

  it('adds .or with only the selected dietary flags', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', dietary: ['vegan', 'halal'] })
    expect(q._m.orCalls).toHaveLength(1)
    expect(q._m.orCalls[0]).toBe('has_vegan_options.eq.true,is_halal.eq.true')
  })

  it('does not add .or when dietary is empty', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, { status: 'live', dietary: [] })
    expect(q._m.orCalls).toEqual([])
  })

  it('combines all three filter dimensions', () => {
    const q = mockQuery()
    buildRestaurantsQuery(q, {
      status: 'draft',
      neighborhoods: ['용산구'],
      dishes: ['taco'],
      dietary: ['vegetarian'],
    })
    expect(q._m.eqCalls).toContainEqual(['status', 'draft'])
    expect(q._m.inCalls).toContainEqual(['neighborhood', ['용산구']])
    expect(q._m.overlapsCalls).toContainEqual(['dish_tags', ['taco']])
    expect(q._m.orCalls).toContainEqual('has_vegetarian_options.eq.true')
  })
})
