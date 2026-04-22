export interface RestaurantRow {
  id: string
  name_ko: string
  name_en: string | null
  dish_tags: string[]
  has_vegan_options: boolean | null
  has_vegetarian_options: boolean | null
  is_halal: boolean | null
}

export interface EnrichmentPatch {
  name_en: string | null
  dish_tags: string[]
  has_vegan_options: boolean | null
  has_vegetarian_options: boolean | null
  is_halal: boolean | null
}

/**
 * Extracts English (Latin-script) substrings from a mixed-language name.
 * Finds all contiguous Latin-script substrings (≥3 chars), joins them with space.
 * Returns null if no valid English substrings found or result is too short.
 */
export function extractNameEn(nameKo: string): string | null {
  // Regex: Find contiguous Latin-script substrings (letters, digits, space, apostrophe, ampersand, period, hyphen)
  const matches = nameKo.match(/[A-Za-z][A-Za-z0-9\s'&.\-]*/g)

  if (!matches) {
    return null
  }

  // Trim each match and filter to length >= 3
  const validMatches = matches
    .map(m => m.trim())
    .filter(m => m.length >= 3)

  if (validMatches.length === 0) {
    return null
  }

  // Join with space and collapse multiple consecutive spaces into single space
  const result = validMatches.join(' ').trim().replace(/\s+/g, ' ')

  // Return result only if length >= 3
  return result.length >= 3 ? result : null
}

/**
 * Infers dish tags from Korean and English keywords in a name.
 * Returns a deduplicated array of tag strings.
 */
export function inferDishTags(nameKo: string): string[] {
  const tags: Set<string> = new Set()

  // Korean keyword → English tag mappings
  const koreanKeywords: Record<string, string> = {
    타코: 'taco',
    부리또: 'burrito',
    부리토: 'burrito',
    케사디아: 'quesadilla',
    퀘사디아: 'quesadilla',
    나초: 'nachos',
    파히타: 'fajita',
    마르가리타: 'margarita',
    엔칠라다: 'enchilada',
    과카몰리: 'guacamole',
    과카몰레: 'guacamole',
    살사: 'salsa',
    토르티야: 'tortilla',
    치폴레: 'chipotle',
  }

  // Check Korean keywords
  for (const [keyword, tag] of Object.entries(koreanKeywords)) {
    if (nameKo.includes(keyword)) {
      tags.add(tag)
    }
  }

  // Check English keywords (case-insensitive)
  const lowerName = nameKo.toLowerCase()
  const englishKeywords: Record<string, string> = {
    taco: 'taco',
    burrito: 'burrito',
    quesadilla: 'quesadilla',
    nacho: 'nachos', // "nacho" → "nachos"
    fajita: 'fajita',
    margarita: 'margarita',
    enchilada: 'enchilada',
    guacamole: 'guacamole',
    salsa: 'salsa',
    tortilla: 'tortilla',
    chipotle: 'chipotle',
  }

  for (const [keyword, tag] of Object.entries(englishKeywords)) {
    if (lowerName.includes(keyword)) {
      tags.add(tag)
    }
  }

  return Array.from(tags).sort()
}

/**
 * Infers dietary flags from Korean and English keywords in a name.
 * Returns object with has_vegan_options, has_vegetarian_options, is_halal
 * (any not matched are set to null).
 */
export function inferDietaryFlags(
  nameKo: string,
): Pick<
  EnrichmentPatch,
  'has_vegan_options' | 'has_vegetarian_options' | 'is_halal'
> {
  const result: Pick<
    EnrichmentPatch,
    'has_vegan_options' | 'has_vegetarian_options' | 'is_halal'
  > = {
    has_vegan_options: null,
    has_vegetarian_options: null,
    is_halal: null,
  }

  const lowerName = nameKo.toLowerCase()

  // Check for halal
  if (nameKo.includes('할랄') || lowerName.includes('halal')) {
    result.is_halal = true
  }

  // Check for vegan (implies vegetarian)
  if (nameKo.includes('비건') || lowerName.includes('vegan')) {
    result.has_vegan_options = true
    result.has_vegetarian_options = true
  }

  // Check for vegetarian (only if vegan not already set)
  if (
    !result.has_vegan_options &&
    (nameKo.includes('채식') || lowerName.includes('vegetarian'))
  ) {
    result.has_vegetarian_options = true
  }

  return result
}

/**
 * Builds an enrichment patch from a restaurant row's name_ko field.
 * Combines extractNameEn, inferDishTags, and inferDietaryFlags.
 */
export function buildEnrichment(row: RestaurantRow): EnrichmentPatch {
  return {
    name_en: extractNameEn(row.name_ko),
    dish_tags: inferDishTags(row.name_ko),
    ...inferDietaryFlags(row.name_ko),
  }
}

/**
 * Computes a diff between the current row state and a new enrichment patch.
 * Returns only fields where the patch value differs from the row value.
 * For arrays (dish_tags), compares by length and element-by-element.
 */
export function computeDiff(
  row: RestaurantRow,
  patch: EnrichmentPatch,
): Partial<EnrichmentPatch> {
  const diff: Partial<EnrichmentPatch> = {}

  // Compare name_en
  if (patch.name_en !== row.name_en) {
    diff.name_en = patch.name_en
  }

  // Compare dish_tags (by length then elements)
  if (
    patch.dish_tags.length !== row.dish_tags.length ||
    !patch.dish_tags.every((tag, i) => tag === row.dish_tags[i])
  ) {
    diff.dish_tags = patch.dish_tags
  }

  // Compare has_vegan_options
  if (patch.has_vegan_options !== row.has_vegan_options) {
    diff.has_vegan_options = patch.has_vegan_options
  }

  // Compare has_vegetarian_options
  if (patch.has_vegetarian_options !== row.has_vegetarian_options) {
    diff.has_vegetarian_options = patch.has_vegetarian_options
  }

  // Compare is_halal
  if (patch.is_halal !== row.is_halal) {
    diff.is_halal = patch.is_halal
  }

  return diff
}
