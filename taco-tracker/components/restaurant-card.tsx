'use client'

import { ArrowUpRight, Leaf, Sprout } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'
import { formatDistance } from '@/scripts/lib/distance'
import { RestaurantPhoto } from './restaurant-photo'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
  distanceMeters?: number | null
  isActive?: boolean
  onSelect: () => void
}

export function RestaurantCard({
  restaurant,
  locale,
  distanceMeters = null,
  isActive = false,
  onSelect,
}: Props) {
  const t = useTranslations('listing.dietary')
  const tListing = useTranslations('listing')

  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  const articleClass = isActive
    ? 'flex min-h-28 overflow-hidden rounded-2xl border border-brand bg-surface shadow-card transition-all'
    : 'flex min-h-28 overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-card transition-all hover:border-brand/40 hover:shadow-[0_12px_30px_rgba(37,40,33,0.12)]'

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      aria-label={primaryName}
    >
      <div className={articleClass}>
        <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3.5 sm:px-5">
          <div className="flex items-baseline gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold leading-tight text-ink sm:text-lg">
                {primaryName}
              </div>
              {secondaryName ? (
                <div className="mt-0.5 truncate text-xs text-muted">{secondaryName}</div>
              ) : null}
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {restaurant.neighborhood ? <span>{restaurant.neighborhood}</span> : null}
            {distanceMeters !== null ? (
              <>
                {restaurant.neighborhood ? <span>·</span> : null}
                <span className="font-medium text-ink">{formatDistance(distanceMeters)}</span>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {restaurant.curator_rating !== null ? (
              <span className="rounded-full bg-brand-deep px-2.5 py-1 text-[11px] font-semibold text-white" title={tListing('curatorScore')}>
                ★ {restaurant.curator_rating.toFixed(1)} <span className="sr-only">{tListing('curatorScore')}</span>
              </span>
            ) : null}
            {restaurant.dish_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-ink/10 bg-bg px-2 py-0.5 text-[11px] text-ink"
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
        <div className="relative w-28 shrink-0 bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8] sm:w-32">
          <RestaurantPhoto coverPhotoUrl={restaurant.cover_photo_url} photoCandidates={restaurant.photo_candidates} className="absolute inset-0" />
        </div>
      </div>
    </button>
  )
}
