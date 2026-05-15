import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRestaurants, type RestaurantStatus } from '@/lib/restaurants'
import { MapListView } from './map/map-list-view'

interface Props {
  status: RestaurantStatus
  locale: 'ko' | 'en'
}

export async function RestaurantList({ status, locale }: Props) {
  const supabase = status === 'live' ? await createClient() : createAdminClient()
  const restaurants = await getRestaurants(supabase, { status })
  return <MapListView restaurants={restaurants} locale={locale} />
}
