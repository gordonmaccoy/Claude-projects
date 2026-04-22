import { describe, it, expect } from 'vitest'
import {
  extractNameEn,
  inferDishTags,
  inferDietaryFlags,
  buildEnrichment,
  computeDiff,
  type RestaurantRow,
  type EnrichmentPatch,
} from '../scripts/lib/enrich'

describe('extractNameEn', () => {
  it('returns null for pure Korean', () => {
    expect(extractNameEn('비토스 어반 타코')).toBeNull()
  })

  it('extracts full English when all Latin script', () => {
    expect(extractNameEn('VATOS URBAN TACOS')).toBe('VATOS URBAN TACOS')
  })

  it('extracts English from mixed Korean and Latin', () => {
    expect(extractNameEn('타코벨 Taco Bell')).toBe('Taco Bell')
  })

  it('extracts English ignoring Korean suffix', () => {
    expect(extractNameEn('El Cholo Mexican 강남점')).toBe('El Cholo Mexican')
  })

  it('returns null for short Latin fragments', () => {
    expect(extractNameEn('타코 A점')).toBeNull()
  })

  it('joins multiple Latin substrings with space', () => {
    expect(extractNameEn('The Taco 가게 Shop')).toBe('The Taco Shop')
  })

  it('handles Latin at the beginning', () => {
    expect(extractNameEn('Taco Republic 타코')).toBe('Taco Republic')
  })

  it('filters fragments shorter than 3 characters', () => {
    expect(extractNameEn('The 타코 El')).toBe('The')
  })

  it('trims whitespace from result', () => {
    expect(extractNameEn('  Taco   Bell  ')).toBe('Taco Bell')
  })

  it('handles apostrophes and hyphens in English names', () => {
    expect(extractNameEn("O'Reilly's Taco Bar")).toBe("O'Reilly's Taco Bar")
  })
})

describe('inferDishTags', () => {
  it('detects taco from Korean 타코', () => {
    const tags = inferDishTags('비토스 타코')
    expect(tags).toContain('taco')
  })

  it('detects burrito from Korean 부리또', () => {
    const tags = inferDishTags('빅 부리또 가게')
    expect(tags).toContain('burrito')
  })

  it('detects burrito from Korean 부리토', () => {
    const tags = inferDishTags('부리토 House')
    expect(tags).toContain('burrito')
  })

  it('detects taco from English Taco', () => {
    const tags = inferDishTags('Taco Bell 홍대점')
    expect(tags).toContain('taco')
  })

  it('detects quesadilla from Korean 케사디아', () => {
    const tags = inferDishTags('케사디아 House')
    expect(tags).toContain('quesadilla')
  })

  it('detects quesadilla from Korean 퀘사디아', () => {
    const tags = inferDishTags('퀘사디아 카페')
    expect(tags).toContain('quesadilla')
  })

  it('detects nachos from Korean 나초', () => {
    const tags = inferDishTags('나초 bar')
    expect(tags).toContain('nachos')
  })

  it('detects fajita from Korean 파히타', () => {
    const tags = inferDishTags('파히타 식당')
    expect(tags).toContain('fajita')
  })

  it('detects margarita from Korean 마르가리타', () => {
    const tags = inferDishTags('마르가리타 bar')
    expect(tags).toContain('margarita')
  })

  it('detects enchilada from Korean 엔칠라다', () => {
    const tags = inferDishTags('엔칠라다 가게')
    expect(tags).toContain('enchilada')
  })

  it('detects guacamole from Korean 과카몰리', () => {
    const tags = inferDishTags('과카몰리 House')
    expect(tags).toContain('guacamole')
  })

  it('detects guacamole from Korean 과카몰레', () => {
    const tags = inferDishTags('과카몰레 restaurant')
    expect(tags).toContain('guacamole')
  })

  it('detects salsa from Korean 살사', () => {
    const tags = inferDishTags('살사 bar')
    expect(tags).toContain('salsa')
  })

  it('detects tortilla from Korean 토르티야', () => {
    const tags = inferDishTags('토르티야 shop')
    expect(tags).toContain('tortilla')
  })

  it('detects chipotle from Korean 치폴레', () => {
    const tags = inferDishTags('치폴레 restaurant')
    expect(tags).toContain('chipotle')
  })

  it('detects taco from English lowercased taco', () => {
    const tags = inferDishTags('taco stand')
    expect(tags).toContain('taco')
  })

  it('detects nacho from English nacho (converts to nachos)', () => {
    const tags = inferDishTags('nacho cheese bar')
    expect(tags).toContain('nachos')
  })

  it('returns empty array for generic name', () => {
    expect(inferDishTags('멕시칸 키친')).toEqual([])
  })

  it('deduplicates tags', () => {
    const tags = inferDishTags('타코 Taco House')
    const tacoCount = tags.filter(t => t === 'taco').length
    expect(tacoCount).toBe(1)
  })

  it('returns deduplicated array when multiple keywords match', () => {
    const tags = inferDishTags('타코 부리또 Taco')
    expect(tags).toHaveLength(2)
    expect(new Set(tags)).toEqual(new Set(['taco', 'burrito']))
  })
})

describe('inferDietaryFlags', () => {
  it('sets is_halal true when contains Korean 할랄', () => {
    const flags = inferDietaryFlags('할랄 타코')
    expect(flags.is_halal).toBe(true)
    expect(flags.has_vegan_options).toBeNull()
    expect(flags.has_vegetarian_options).toBeNull()
  })

  it('sets is_halal true when contains English halal (case-insensitive)', () => {
    const flags = inferDietaryFlags('HALAL Taco')
    expect(flags.is_halal).toBe(true)
  })

  it('sets both vegan flags true when contains Korean 비건', () => {
    const flags = inferDietaryFlags('비건 멕시칸')
    expect(flags.has_vegan_options).toBe(true)
    expect(flags.has_vegetarian_options).toBe(true)
    expect(flags.is_halal).toBeNull()
  })

  it('sets both vegan flags true when contains English vegan (case-insensitive)', () => {
    const flags = inferDietaryFlags('Vegan Taco')
    expect(flags.has_vegan_options).toBe(true)
    expect(flags.has_vegetarian_options).toBe(true)
  })

  it('sets vegetarian flag true when contains Korean 채식', () => {
    const flags = inferDietaryFlags('채식 타코')
    expect(flags.has_vegetarian_options).toBe(true)
    expect(flags.has_vegan_options).toBeNull()
    expect(flags.is_halal).toBeNull()
  })

  it('sets vegetarian flag true when contains English vegetarian (case-insensitive)', () => {
    const flags = inferDietaryFlags('Vegetarian Mexican')
    expect(flags.has_vegetarian_options).toBe(true)
    expect(flags.has_vegan_options).toBeNull()
  })

  it('returns all nulls for generic name', () => {
    const flags = inferDietaryFlags('VATOS URBAN TACOS')
    expect(flags.has_vegan_options).toBeNull()
    expect(flags.has_vegetarian_options).toBeNull()
    expect(flags.is_halal).toBeNull()
  })

  it('returns all nulls for empty string', () => {
    const flags = inferDietaryFlags('')
    expect(flags.has_vegan_options).toBeNull()
    expect(flags.has_vegetarian_options).toBeNull()
    expect(flags.is_halal).toBeNull()
  })
})

describe('buildEnrichment', () => {
  const baseRow: RestaurantRow = {
    id: 'test-id',
    name_ko: 'El Cholo 강남점 타코',
    name_en: null,
    dish_tags: [],
    has_vegan_options: null,
    has_vegetarian_options: null,
    is_halal: null,
  }

  it('extracts name_en correctly', () => {
    const patch = buildEnrichment(baseRow)
    expect(patch.name_en).toBe('El Cholo')
  })

  it('infers dish_tags correctly', () => {
    const patch = buildEnrichment(baseRow)
    expect(patch.dish_tags).toContain('taco')
  })

  it('infers dietary flags correctly', () => {
    const patch = buildEnrichment(baseRow)
    expect(patch.has_vegan_options).toBeNull()
    expect(patch.has_vegetarian_options).toBeNull()
    expect(patch.is_halal).toBeNull()
  })

  it('builds enrichment with vegan name', () => {
    const veganRow = { ...baseRow, name_ko: '비건 타코 El Paso' }
    const patch = buildEnrichment(veganRow)
    expect(patch.has_vegan_options).toBe(true)
    expect(patch.has_vegetarian_options).toBe(true)
    expect(patch.dish_tags).toContain('taco')
    expect(patch.name_en).toBe('El Paso')
  })
})

describe('computeDiff', () => {
  const baseRow: RestaurantRow = {
    id: 'test-id',
    name_ko: '타코벨',
    name_en: null,
    dish_tags: [],
    has_vegan_options: null,
    has_vegetarian_options: null,
    is_halal: null,
  }

  it('returns empty object when nothing changes', () => {
    const patch: EnrichmentPatch = {
      name_en: null,
      dish_tags: [],
      has_vegan_options: null,
      has_vegetarian_options: null,
      is_halal: null,
    }
    const diff = computeDiff(baseRow, patch)
    expect(diff).toEqual({})
  })

  it('includes only changed fields in diff', () => {
    const patch: EnrichmentPatch = {
      name_en: 'Taco Bell',
      dish_tags: ['taco'],
      has_vegan_options: null,
      has_vegetarian_options: null,
      is_halal: null,
    }
    const diff = computeDiff(baseRow, patch)
    expect(diff.name_en).toBe('Taco Bell')
    expect(diff.dish_tags).toEqual(['taco'])
    expect(diff.has_vegan_options).toBeUndefined()
    expect(diff.is_halal).toBeUndefined()
  })

  it('detects name_en change from null to string', () => {
    const patch: EnrichmentPatch = {
      name_en: 'Taco Stand',
      dish_tags: [],
      has_vegan_options: null,
      has_vegetarian_options: null,
      is_halal: null,
    }
    const diff = computeDiff(baseRow, patch)
    expect('name_en' in diff).toBe(true)
  })

  it('detects dietary flag change from null to true', () => {
    const halalRow = { ...baseRow, is_halal: null }
    const patch: EnrichmentPatch = {
      name_en: null,
      dish_tags: [],
      has_vegan_options: null,
      has_vegetarian_options: null,
      is_halal: true,
    }
    const diff = computeDiff(halalRow, patch)
    expect(diff.is_halal).toBe(true)
  })

  it('detects dish_tags change by length', () => {
    const patch: EnrichmentPatch = {
      name_en: null,
      dish_tags: ['taco', 'burrito'],
      has_vegan_options: null,
      has_vegetarian_options: null,
      is_halal: null,
    }
    const diff = computeDiff(baseRow, patch)
    expect('dish_tags' in diff).toBe(true)
  })

  it('detects dish_tags change by element difference', () => {
    const rowWithTags = { ...baseRow, dish_tags: ['taco'] }
    const patch: EnrichmentPatch = {
      name_en: null,
      dish_tags: ['burrito'],
      has_vegan_options: null,
      has_vegetarian_options: null,
      is_halal: null,
    }
    const diff = computeDiff(rowWithTags, patch)
    expect('dish_tags' in diff).toBe(true)
  })

  it('does not include is_halal in diff when it stays null', () => {
    const patch: EnrichmentPatch = {
      name_en: 'El Paso',
      dish_tags: [],
      has_vegan_options: null,
      has_vegetarian_options: null,
      is_halal: null,
    }
    const diff = computeDiff(baseRow, patch)
    expect('is_halal' in diff).toBe(false)
  })
})
