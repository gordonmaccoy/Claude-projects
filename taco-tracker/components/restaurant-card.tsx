'use client'

import { useRef } from 'react'
import { Leaf, Sprout } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'
import { formatDistance } from '@/scripts/lib/distance'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
  distanceMeters?: number | null
  isActive?: boolean
  onSingleClick: () => void
  onDoubleClick: () => void
}

const DOUBLE_CLICK_DELAY_MS = 250

export function RestaurantCard({
  restaurant,
  locale,
  distanceMeters = null,
  isActive = false,
  onSingleClick,
  onDoubleClick,
}: Props) {
  const t = useTranslations('listing.dietary')
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClick = () => {
    if (clickTimer.current) {
      // Second click within delay window — treat as double click
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      onDoubleClick()
      return
    }
    // First click — schedule single-click handler
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      onSingleClick()
    }, DOUBLE_CLICK_DELAY_MS)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onDoubleClick() // Enter = "open" (most explicit action)
    }
  }

  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  const articleClass = isActive
    ? 'flex overflow-hidden rounded-lg border-2 border-brand bg-bg shadow-card transition-shadow'
    : 'flex overflow-hidden rounded-lg border-2 border-transparent bg-surface shadow-card transition-shadow group-hover:shadow-[0_4px_12px_rgba(27,25,22,0.12)]'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <article className={articleClass}>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5 sm:px-4">
          <div className="flex items-baseline gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold leading-tight text-ink sm:text-base">
                {primaryName}
              </div>
              {secondaryName ? (
                <div className="truncate text-[11px] text-muted">{secondaryName}</div>
              ) : null}
            </div>
            {restaurant.curator_rating !== null ? (
              <div className="whitespace-nowrap text-xs font-semibold text-brand">
                ★ {restaurant.curator_rating.toFixed(1)}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            {restaurant.neighborhood ? <span>{restaurant.neighborhood}</span> : null}
            {distanceMeters !== null ? (
              <>
                {restaurant.neighborhood ? <span>·</span> : null}
                <span className="font-medium text-ink">{formatDistance(distanceMeters)}</span>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {restaurant.dish_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-ink bg-bg px-1.5 py-0.5 text-[10px] text-ink"
              >
                {tag}
              </span>
            ))}
            {restaurant.has_vegan_options ? (
              <Leaf className="h-3 w-3 text-accent" aria-label={t('vegan')} />
            ) : restaurant.has_vegetarian_options ? (
              <Sprout className="h-3 w-3 text-accent" aria-label={t('vegetarian')} />
            ) : null}
          </div>
        </div>
        <div className="relative h-20 w-20 shrink-0 self-center bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8] sm:h-24 sm:w-24">
          {restaurant.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.cover_photo_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
      </article>
    </div>
  )
}
