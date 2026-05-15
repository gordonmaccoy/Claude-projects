'use client'

import { Leaf, Sprout, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
  onClose: () => void
  onSelectDetail: () => void
}

export function RestaurantPopover({ restaurant, locale, onClose, onSelectDetail }: Props) {
  const t = useTranslations('listing.dietary')
  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  return (
    <div className="w-[220px] overflow-hidden rounded-lg bg-surface shadow-[0_4px_16px_rgba(27,25,22,0.18)]">
      <button
        type="button"
        onClick={onSelectDetail}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8]">
          {restaurant.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.cover_photo_url} alt="" className="h-full w-full object-cover" />
          ) : null}
          <span
            role="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose()
            }}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-surface/95 text-ink shadow-card"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="px-3 py-2.5">
          <div className="truncate text-sm font-bold leading-tight text-ink">{primaryName}</div>
          {secondaryName ? (
            <div className="truncate text-[11px] text-muted">{secondaryName}</div>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {restaurant.neighborhood ? (
              <span className="text-[11px] text-muted">{restaurant.neighborhood}</span>
            ) : null}
            {restaurant.dish_tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-ink bg-bg px-1.5 py-0.5 text-[9px] text-ink"
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
      </button>
    </div>
  )
}
