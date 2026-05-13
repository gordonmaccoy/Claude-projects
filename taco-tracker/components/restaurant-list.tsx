import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRestaurants, getNeighborhoods, type RestaurantStatus } from '@/lib/restaurants'
import { getTranslations } from 'next-intl/server'
import { RestaurantCard } from './restaurant-card'
import { NeighborhoodFilter } from './neighborhood-filter'

interface Props {
  status: RestaurantStatus
  neighborhood: string | null
  locale: 'ko' | 'en'
  basePath: '/' | '/curate'
}

export async function RestaurantList({ status, neighborhood, locale, basePath }: Props) {
  // RLS only allows anon reads of live rows. Draft/archived listings (e.g. /curate)
  // must use the service role client. Service role usage is server-side only.
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
      {count === 0 ? (
        <p className="py-16 text-center text-muted">{t('emptyState')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {restaurants.map((r) => (
            <li key={r.id}>
              <RestaurantCard restaurant={r} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
