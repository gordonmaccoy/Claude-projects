'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'
import { RestaurantCard } from '../restaurant-card'
import { KakaoMap } from './kakao-map'
import { isInsideBounds, type ViewportBounds } from '@/scripts/lib/viewport-bounds'
import { SearchBar } from '../search-bar'
import { MapFilters, DEFAULT_MAP_FILTERS, type MapFiltersState } from '../map-filters'

interface Props {
  restaurants: Restaurant[]
  locale: 'ko' | 'en'
}

function passesMapFilters(r: Restaurant, f: MapFiltersState): boolean {
  if (!f.showWithoutRatings && r.curator_rating === null) return false
  if (f.minRating > 0 && (r.curator_rating === null || r.curator_rating < f.minRating)) return false
  if (f.vegetarianOnly && r.has_vegetarian_options !== true) return false
  if (f.veganOnly && r.has_vegan_options !== true) return false
  // hideMyRated is a placeholder; no-op for now (no auth, no user reviews yet)
  return true
}

function matchesQuery(r: Restaurant, q: string): boolean {
  if (q.length === 0) return true
  const needle = q.toLowerCase()
  if (r.name_ko.toLowerCase().includes(needle)) return true
  if (r.name_en && r.name_en.toLowerCase().includes(needle)) return true
  if (r.neighborhood && r.neighborhood.toLowerCase().includes(needle)) return true
  return false
}

export function MapListView({ restaurants, locale }: Props) {
  const t = useTranslations('listing')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tab, setTab] = useState<'map' | 'list'>('map')
  const [bounds, setBounds] = useState<ViewportBounds | null>(null)
  const [query, setQuery] = useState('')
  const [mapFilters, setMapFilters] = useState<MapFiltersState>(DEFAULT_MAP_FILTERS)

  const handlePinClick = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? null : id))
  }, [])

  const handlePopoverClose = useCallback(() => setActiveId(null), [])
  const handleBoundsChange = useCallback((b: ViewportBounds) => setBounds(b), [])

  const restaurantById = useMemo(() => {
    const m = new Map<string, Restaurant>()
    for (const r of restaurants) m.set(r.id, r)
    return m
  }, [restaurants])

  // Map shows everything matching the search query (search is global, not viewport-bound).
  const queryMatched = useMemo(
    () => restaurants.filter((r) => matchesQuery(r, query) && passesMapFilters(r, mapFilters)),
    [restaurants, query, mapFilters]
  )

  // List additionally filters by current map viewport (if known).
  const visibleRestaurants = useMemo(() => {
    if (!bounds) return queryMatched
    return queryMatched.filter((r) => isInsideBounds(r.lat, r.lng, bounds))
  }, [queryMatched, bounds])

  if (restaurants.length === 0) {
    return <p className="py-16 text-center text-muted">{t('emptyState')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchBar value={query} onChange={setQuery} />
        </div>
        <MapFilters filters={mapFilters} onApply={setMapFilters} />
        <p className="text-sm text-muted">
          {query.length > 0
            ? t('resultCountFiltered', { count: visibleRestaurants.length })
            : t('resultCountAll', { count: visibleRestaurants.length })}
        </p>
      </div>

      {/* Mobile tabs */}
      <div className="flex gap-1 self-start rounded-full border border-ink bg-surface p-1 md:hidden">
        <button
          type="button"
          onClick={() => setTab('map')}
          className={tabClass(tab === 'map')}
          aria-pressed={tab === 'map'}
        >
          {t('tabs.map')}
        </button>
        <button
          type="button"
          onClick={() => setTab('list')}
          className={tabClass(tab === 'list')}
          aria-pressed={tab === 'list'}
        >
          {t('tabs.list')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[65%_35%]">
        <div className={tab === 'map' ? 'block' : 'hidden md:block'}>
          <div className="h-[60vh] md:sticky md:top-20 md:h-[calc(100vh-7rem)]">
            <KakaoMap
              restaurants={queryMatched}
              restaurantById={restaurantById}
              activeId={activeId}
              locale={locale}
              onPinClick={handlePinClick}
              onPopoverClose={handlePopoverClose}
              onBoundsChange={handleBoundsChange}
            />
          </div>
        </div>
        <div className={tab === 'list' ? 'block' : 'hidden md:block'}>
          {visibleRestaurants.length === 0 ? (
            <p className="py-16 text-center text-muted">{t('emptyStateBounds')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
              {visibleRestaurants.map((r) => (
                <li key={r.id}>
                  <RestaurantCard restaurant={r} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function tabClass(isActive: boolean): string {
  const base =
    'rounded-full px-4 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
  return isActive ? `${base} bg-brand text-surface` : `${base} text-ink hover:bg-bg`
}
