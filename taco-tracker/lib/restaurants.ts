import type { SupabaseClient } from '@supabase/supabase-js'

export type RestaurantStatus = 'draft' | 'live' | 'archived'
export type DietaryFlag = 'vegan' | 'vegetarian' | 'halal'
export type EnrichmentConfidence = 'high' | 'medium' | 'low'

export interface Restaurant {
  id: string
  slug: string
  name_ko: string
  name_en: string | null
  neighborhood: string | null
  address_ko: string
  kakao_place_id: string | null
  phone: string | null
  instagram: string | null
  lat: number
  lng: number
  dish_tags: string[]
  has_vegan_options: boolean | null
  has_vegetarian_options: boolean | null
  is_halal: boolean | null
  cover_photo_url: string | null
  photo_candidates: string[]
  curator_rating: number | null
  enrichment_confidence: EnrichmentConfidence | null
  needs_review: boolean
  review_reason: string | null
}

export interface RestaurantFilters {
  status: RestaurantStatus
  neighborhoods?: string[]
  dishes?: string[]
  dietary?: DietaryFlag[]
}

const RESTAURANT_COLUMNS =
  'id, slug, name_ko, name_en, neighborhood, address_ko, kakao_place_id, phone, instagram, lat, lng, ' +
  'dish_tags, has_vegan_options, has_vegetarian_options, is_halal, cover_photo_url, photo_candidates, ' +
  'curator_rating, enrichment_confidence, needs_review, review_reason'

const DIETARY_COLUMN: Record<DietaryFlag, string> = {
  vegan: 'has_vegan_options',
  vegetarian: 'has_vegetarian_options',
  halal: 'is_halal',
}

/**
 * Applies filter clauses to a Supabase query builder. Pure helper extracted
 * for testability without a live DB.
 */
export function buildRestaurantsQuery<Q extends {
  eq: (col: string, v: unknown) => Q
  in: (col: string, v: unknown[]) => Q
  overlaps: (col: string, v: unknown[]) => Q
  or: (expr: string) => Q
  order: (col: string, opts: { ascending: boolean }) => Q
}>(q: Q, filters: RestaurantFilters): Q {
  let query = q.eq('status', filters.status)

  if (filters.neighborhoods && filters.neighborhoods.length > 0) {
    query = query.in('neighborhood', filters.neighborhoods)
  }

  if (filters.dishes && filters.dishes.length > 0) {
    query = query.overlaps('dish_tags', filters.dishes)
  }

  if (filters.dietary && filters.dietary.length > 0) {
    const expr = filters.dietary.map((d) => `${DIETARY_COLUMN[d]}.eq.true`).join(',')
    query = query.or(expr)
  }

  query = query.order('name_ko', { ascending: true })
  return query
}

export async function getRestaurants(
  supabase: SupabaseClient,
  filters: RestaurantFilters
): Promise<Restaurant[]> {
  const base = supabase.from('restaurants').select(RESTAURANT_COLUMNS)
  const filtered = buildRestaurantsQuery(
    base as unknown as Parameters<typeof buildRestaurantsQuery>[0],
    filters
  ) as ReturnType<typeof base.order>
  const { data, error } = await filtered.returns<Restaurant[]>()
  if (error) throw new Error(`Failed to fetch restaurants: ${error.message}`)
  return data ?? []
}

export async function getRestaurantBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select(RESTAURANT_COLUMNS)
    .eq('slug', slug)
    .neq('status', 'archived')
    .maybeSingle()
    .returns<Restaurant | null>()
  if (error) throw new Error(`Failed to fetch restaurant ${slug}: ${error.message}`)
  return data
}

/**
 * Pure helper: deduplicate, sort, and drop null neighborhoods.
 * Extracted so the logic is testable without mocking Supabase.
 */
export function dedupeNeighborhoods(
  rows: { neighborhood: string | null }[]
): string[] {
  const set = new Set<string>()
  for (const row of rows) {
    if (row.neighborhood !== null) set.add(row.neighborhood)
  }
  return Array.from(set).sort()
}

export async function getNeighborhoods(
  supabase: SupabaseClient,
  status: RestaurantStatus
): Promise<string[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('neighborhood')
    .eq('status', status)
    .not('neighborhood', 'is', null)
    .returns<{ neighborhood: string | null }[]>()

  if (error) throw new Error(`Failed to fetch neighborhoods: ${error.message}`)
  return dedupeNeighborhoods(data ?? [])
}

/**
 * Distinct dish tags present in the data for a given status.
 * Used to derive the set of dish filter chips to show.
 */
export async function getDishTags(
  supabase: SupabaseClient,
  status: RestaurantStatus
): Promise<string[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('dish_tags')
    .eq('status', status)
    .returns<{ dish_tags: string[] }[]>()
  if (error) throw new Error(`Failed to fetch dish tags: ${error.message}`)
  const set = new Set<string>()
  for (const row of data ?? []) {
    for (const t of row.dish_tags ?? []) set.add(t)
  }
  return Array.from(set).sort()
}
