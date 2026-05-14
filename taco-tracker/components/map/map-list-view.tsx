'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'
import { RestaurantCard } from '../restaurant-card'
import { KakaoMap } from './kakao-map'
import { isInsideBounds, type ViewportBounds } from '@/scripts/lib/viewport-bounds'

interface Props {
  restaurants: Restaurant[]
  locale: 'ko' | 'en'
}

export function MapListView({ restaurants, locale }: Props) {
  const t = useTranslations('listing')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tab, setTab] = useState<'map' | 'list'>('map')
  const [bounds, setBounds] = useState<ViewportBounds | null>(null)

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

  const visibleRestaurants = useMemo(() => {
    if (!bounds) return restaurants
    return restaurants.filter((r) => isInsideBounds(r.lat, r.lng, bounds))
  }, [restaurants, bounds])

  if (restaurants.length === 0) {
    return <p className="py-16 text-center text-muted">{t('emptyState')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
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
          <div className="h-[60vh] md:sticky md:top-4 md:h-[calc(100vh-8rem)]">
            <KakaoMap
              restaurants={restaurants}
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
