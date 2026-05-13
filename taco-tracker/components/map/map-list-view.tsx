'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'
import { RestaurantCard } from '../restaurant-card'
import { KakaoMap } from './kakao-map'

interface Props {
  restaurants: Restaurant[]
  locale: 'ko' | 'en'
}

export function MapListView({ restaurants, locale }: Props) {
  const t = useTranslations('listing')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tab, setTab] = useState<'map' | 'list'>('map')
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map())

  const handlePinClick = (id: string) => {
    setActiveId((prev) => (prev === id ? null : id))
    const el = cardRefs.current.get(id)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const mapRestaurants = restaurants.map((r) => ({
    id: r.id,
    lat: r.lat,
    lng: r.lng,
  }))

  if (restaurants.length === 0) {
    return <p className="py-16 text-center text-muted">{t('emptyState')}</p>
  }

  return (
    <div className="flex flex-col gap-3">
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

      {/* Layout: stacked on mobile (only one shown), grid on desktop */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[3fr_2fr]">
        <div className={tab === 'map' ? 'block' : 'hidden md:block'}>
          <div className="h-[60vh] md:sticky md:top-4 md:h-[calc(100vh-8rem)]">
            <KakaoMap
              restaurants={mapRestaurants}
              activeId={activeId}
              onPinClick={handlePinClick}
            />
          </div>
        </div>
        <div className={tab === 'list' ? 'block' : 'hidden md:block'}>
          <ul className="flex flex-col gap-3">
            {restaurants.map((r) => (
              <li
                key={r.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(r.id, el)
                  else cardRefs.current.delete(r.id)
                }}
              >
                <RestaurantCard
                  restaurant={r}
                  locale={locale}
                  isActive={activeId === r.id}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function tabClass(isActive: boolean): string {
  const base =
    'rounded-full px-4 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
  return isActive
    ? `${base} bg-brand text-surface`
    : `${base} text-ink hover:bg-bg`
}
