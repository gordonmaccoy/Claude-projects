import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRestaurants, getNeighborhoods, type RestaurantStatus } from '@/lib/restaurants'
import { getTranslations } from 'next-intl/server'
import { NeighborhoodFilter } from './neighborhood-filter'
import { MapListView } from './map/map-list-view'

interface Props {
  status: RestaurantStatus
  neighborhood: string | null
  locale: 'ko' | 'en'
  basePath: '/' | '/curate'
}

export async function RestaurantList({ status, neighborhood, locale, basePath }: Props) {
  const supabase = status === 'live' ? await createClient() : createAdminClient()

  const [restaurants, neighborhoods] = await Promise.all([
    getRestaurants(supabase, {
      status,
      neighborhood: neighborhood ?? undefined,
    }),
    getNeighborhoods(supabase, status),
  ])

  const t = await getTranslations('listing')
  const count = restaurants.length

  return (
    <div className="flex flex-col gap-4">
      <NeighborhoodFilter
        neighborhoods={neighborhoods}
        active={neighborhood}
        basePath={basePath}
      />
      <p className="text-sm text-muted">
        {neighborhood
          ? t('resultCountFiltered', { count, neighborhood })
          : t('resultCountAll', { count })}
      </p>
      <MapListView restaurants={restaurants} locale={locale} />
    </div>
  )
}
