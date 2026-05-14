import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getRestaurants,
  getNeighborhoods,
  getDishTags,
  type RestaurantStatus,
  type DietaryFlag,
} from '@/lib/restaurants'
import { getTranslations } from 'next-intl/server'
import { NeighborhoodFilter } from './neighborhood-filter'
import { DishFilter } from './dish-filter'
import { DietaryFilter } from './dietary-filter'
import { MapListView } from './map/map-list-view'

interface Props {
  status: RestaurantStatus
  neighborhood: string | null   // raw search param value (comma-separated)
  dish: string | null
  dietary: string | null
  locale: 'ko' | 'en'
  basePath: '/' | '/curate'
}

const DIETARY_VALUES: DietaryFlag[] = ['vegan', 'vegetarian', 'halal']

function splitCsv(s: string | null): string[] {
  if (!s) return []
  return s.split(',').map((v) => v.trim()).filter((v) => v.length > 0)
}

export async function RestaurantList({
  status,
  neighborhood,
  dish,
  dietary,
  locale,
  basePath,
}: Props) {
  const supabase = status === 'live' ? await createClient() : createAdminClient()

  const neighborhoodValues = splitCsv(neighborhood)
  const dishValues = splitCsv(dish)
  const dietaryValues = splitCsv(dietary).filter((v): v is DietaryFlag =>
    DIETARY_VALUES.includes(v as DietaryFlag)
  )

  const [restaurants, neighborhoods, dishTags] = await Promise.all([
    getRestaurants(supabase, {
      status,
      neighborhoods: neighborhoodValues.length > 0 ? neighborhoodValues : undefined,
      dishes: dishValues.length > 0 ? dishValues : undefined,
      dietary: dietaryValues.length > 0 ? dietaryValues : undefined,
    }),
    getNeighborhoods(supabase, status),
    getDishTags(supabase, status),
  ])

  const t = await getTranslations('listing')
  const count = restaurants.length

  const currentParams: Record<string, string | undefined> = {
    neighborhood: neighborhood ?? undefined,
    dish: dish ?? undefined,
    dietary: dietary ?? undefined,
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          {t('filters.neighborhood')}
        </div>
        <NeighborhoodFilter
          neighborhoods={neighborhoods}
          active={neighborhoodValues}
          basePath={basePath}
          currentParams={currentParams}
        />
      </div>
      {dishTags.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            {t('filters.dish')}
          </div>
          <DishFilter
            dishes={dishTags}
            active={dishValues}
            basePath={basePath}
            currentParams={currentParams}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          {t('filters.dietary')}
        </div>
        <DietaryFilter
          active={dietaryValues}
          basePath={basePath}
          currentParams={currentParams}
        />
      </div>
      <p className="mt-1 text-sm text-muted">
        {neighborhoodValues.length > 0 || dishValues.length > 0 || dietaryValues.length > 0
          ? t('resultCountFiltered', { count })
          : t('resultCountAll', { count })}
      </p>
      <MapListView restaurants={restaurants} locale={locale} />
    </div>
  )
}
