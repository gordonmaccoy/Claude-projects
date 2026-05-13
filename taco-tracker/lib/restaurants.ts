import type { SupabaseClient } from '@supabase/supabase-js'

export type RestaurantStatus = 'draft' | 'live' | 'archived'

export interface Restaurant {
  id: string
  slug: string
  name_ko: string
  name_en: string | null
  neighborhood: string | null
  address_ko: string
  kakao_place_id: string | null
  lat: number
  lng: number
  dish_tags: string[]
  has_vegan_options: boolean | null
  has_vegetarian_options: boolean | null
  is_halal: boolean | null
  cover_photo_url: string | null
  curator_rating: number | null
}

const RESTAURANT_COLUMNS =
  'id, slug, name_ko, name_en, neighborhood, address_ko, kakao_place_id, lat, lng, dish_tags, ' +
  'has_vegan_options, has_vegetarian_options, is_halal, cover_photo_url, curator_rating'

export async function getRestaurants(
  supabase: SupabaseClient,
  filters: { status: RestaurantStatus; neighborhood?: string }
): Promise<Restaurant[]> {
  let query = supabase
    .from('restaurants')
    .select(RESTAURANT_COLUMNS)
    .eq('status', filters.status)
    .order('name_ko', { ascending: true })

  if (filters.neighborhood) {
    query = query.eq('neighborhood', filters.neighborhood)
  }

  const { data, error } = await query.returns<Restaurant[]>()
  if (error) throw new Error(`Failed to fetch restaurants: ${error.message}`)
  return data ?? []
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
