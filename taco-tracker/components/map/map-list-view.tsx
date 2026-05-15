'use client'

import { useCallback, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'
import { RestaurantCard } from '../restaurant-card'
import { RestaurantDetail } from '../restaurant-detail'
import { KakaoMap } from './kakao-map'
import { isInsideBounds, type ViewportBounds } from '@/scripts/lib/viewport-bounds'
import { SearchBar } from '../search-bar'
import { MapFilters, DEFAULT_MAP_FILTERS, type MapFiltersState } from '../map-filters'
import { NearMeButton } from '../near-me-button'
import { haversineMeters } from '@/scripts/lib/distance'

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
  if (r.neighborhood_en && r.neighborhood_en.toLowerCase().includes(needle)) return true
  return false
}

export function MapListView({ restaurants, locale }: Props) {
  const t = useTranslations('listing')
  const tNear = useTranslations('listing.nearMe')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null)
  const [tab, setTab] = useState<'map' | 'list'>('map')
  const [bounds, setBounds] = useState<ViewportBounds | null>(null)
  const [query, setQuery] = useState('')
  const [mapFilters, setMapFilters] = useState<MapFiltersState>(DEFAULT_MAP_FILTERS)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [nearMeActive, setNearMeActive] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)

  const handlePinClick = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? null : id))
  }, [])

  const handlePopoverClose = useCallback(() => setActiveId(null), [])

  const handleCardSingleClick = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const handleCardDoubleClick = useCallback((id: string) => {
    setSelectedDetailId(id)
    setActiveId(null)
  }, [])

  const handleSelectDetail = useCallback((id: string) => {
    setSelectedDetailId(id)
    setActiveId(null)
  }, [])

  const handleDetailBack = useCallback(() => {
    setSelectedDetailId(null)
  }, [])

  const handleBoundsChange = useCallback((b: ViewportBounds) => setBounds(b), [])

  const requestLocation = useCallback((opts: { activateNearMe: boolean }) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError(tNear('unavailable'))
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        if (opts.activateNearMe) setNearMeActive(true)
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) setLocateError(tNear('denied'))
        else setLocateError(tNear('unavailable'))
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [tNear])

  const handleNearMeClick = useCallback(() => {
    requestLocation({ activateNearMe: true })
  }, [requestLocation])

  const handleNearMeClear = useCallback(() => {
    setNearMeActive(false)
  }, [])

  const handleLocateClick = useCallback(() => {
    requestLocation({ activateNearMe: false })
  }, [requestLocation])

  const restaurantById = useMemo(() => {
    const m = new Map<string, Restaurant>()
    for (const r of restaurants) m.set(r.id, r)
    return m
  }, [restaurants])

  const selectedRestaurant = selectedDetailId !== null ? restaurantById.get(selectedDetailId) ?? null : null

  // Map shows everything matching the search query (search is global, not viewport-bound).
  const queryMatched = useMemo(
    () => restaurants.filter((r) => matchesQuery(r, query) && passesMapFilters(r, mapFilters)),
    [restaurants, query, mapFilters]
  )

  // List additionally filters by current map viewport (if known), and sorts by distance when near-me is active.
  // When a search query is active, skip the viewport filter so all matching restaurants appear regardless of map position.
  const visibleRestaurants = useMemo(() => {
    const inViewport = (bounds && query.length === 0)
      ? queryMatched.filter((r) => isInsideBounds(r.lat, r.lng, bounds))
      : queryMatched
    if (nearMeActive && userLocation) {
      return [...inViewport].sort(
        (a, b) =>
          haversineMeters(userLocation.lat, userLocation.lng, a.lat, a.lng) -
          haversineMeters(userLocation.lat, userLocation.lng, b.lat, b.lng)
      )
    }
    return inViewport
  }, [queryMatched, bounds, nearMeActive, userLocation, query])

  if (restaurants.length === 0) {
    return <p className="py-16 text-center text-muted">{t('emptyState')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar — always full width */}
      <SearchBar value={query} onChange={setQuery} />

      {/* ── Mobile: single pill control row ── */}
      <div className="flex items-center gap-1.5 md:hidden">
        {/* Map / List toggle */}
        <div className="flex rounded-full border border-ink bg-surface p-0.5">
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
        <NearMeButton
          active={nearMeActive}
          locating={locating}
          onClick={handleNearMeClick}
          onClear={handleNearMeClear}
          compact
        />
        <MapFilters filters={mapFilters} onApply={setMapFilters} compact />
      </div>

      {/* ── Desktop: control row ── */}
      <div className="hidden items-center gap-2 md:flex">
        <NearMeButton
          active={nearMeActive}
          locating={locating}
          onClick={handleNearMeClick}
          onClear={handleNearMeClear}
        />
        <MapFilters filters={mapFilters} onApply={setMapFilters} />
        <button
          type="button"
          disabled
          title={t('addLocation')}
          className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-muted bg-surface px-3 text-sm text-muted opacity-70"
        >
          <Plus className="h-4 w-4" />
          <span>{t('addLocation')}</span>
        </button>
      </div>

      {/* Result count + locate error — desktop */}
      <div className="hidden items-center justify-between gap-2 text-sm text-muted md:flex">
        <span>
          {query.length > 0
            ? t('resultCountFiltered', { count: visibleRestaurants.length })
            : t('resultCountAll', { count: visibleRestaurants.length })}
        </span>
        {locateError ? <span className="text-brand">{locateError}</span> : null}
      </div>
      {/* Locate error — mobile */}
      {locateError ? <span className="text-sm text-brand md:hidden">{locateError}</span> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[65%_35%]">
        {/* Map column */}
        <div className={tab === 'map' ? 'block' : 'hidden md:block'}>
          <div className="relative h-[calc(100dvh-11rem)] md:sticky md:top-20 md:h-[calc(100vh-7rem)]">
            <KakaoMap
              restaurants={queryMatched}
              restaurantById={restaurantById}
              activeId={activeId}
              locale={locale}
              userLocation={userLocation}
              panToId={activeId}
              onPinClick={handlePinClick}
              onPopoverClose={handlePopoverClose}
              onBoundsChange={handleBoundsChange}
              onLocateClick={handleLocateClick}
              onSelectDetail={handleSelectDetail}
            />
            {/* Add a location — mobile only, floats above the locate button */}
            <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 md:hidden">
              <button
                type="button"
                disabled
                className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-muted bg-surface/90 px-4 text-sm text-muted opacity-80 shadow-sm backdrop-blur-sm"
              >
                <Plus className="h-4 w-4" />
                {t('addLocation')}
              </button>
            </div>
          </div>
        </div>

        {/* List column */}
        <div className={tab === 'list' ? 'block' : 'hidden md:block'}>
          {selectedRestaurant ? (
            <RestaurantDetail
              restaurant={selectedRestaurant}
              locale={locale}
              onBack={handleDetailBack}
              inline
            />
          ) : visibleRestaurants.length === 0 ? (
            <p className="py-16 text-center text-muted">{t('emptyStateBounds')}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visibleRestaurants.map((r) => (
                <li key={r.id}>
                  <RestaurantCard
                    restaurant={r}
                    locale={locale}
                    isActive={activeId === r.id}
                    distanceMeters={
                      userLocation
                        ? haversineMeters(userLocation.lat, userLocation.lng, r.lat, r.lng)
                        : null
                    }
                    onSingleClick={() => handleCardSingleClick(r.id)}
                    onDoubleClick={() => handleCardDoubleClick(r.id)}
                  />
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
