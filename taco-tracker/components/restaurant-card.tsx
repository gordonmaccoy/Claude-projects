'use client'

import { Link } from '@/i18n/navigation'
import { Leaf, Sprout, Wheat } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Restaurant } from '@/lib/restaurants'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
}

export function RestaurantCard({ restaurant, locale }: Props) {
  const t = useTranslations('listing.dietary')

  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  return (
    <Link
      href={`/restaurant/${restaurant.slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <article className="overflow-hidden rounded-lg bg-surface shadow-card transition-shadow group-hover:shadow-[0_4px_12px_rgba(27,25,22,0.12)]">
        <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8]">
          {restaurant.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.cover_photo_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
          {restaurant.curator_rating !== null ? (
            <div className="absolute right-2 top-2 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-brand shadow-card">
              ★ {restaurant.curator_rating.toFixed(1)}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-3">
          <div className="min-w-0">
            <div className="truncate text-base font-bold leading-tight text-ink">
              {primaryName}
            </div>
            {secondaryName ? (
              <div className="truncate text-xs text-muted">{secondaryName}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {restaurant.neighborhood ? (
              <span className="text-xs text-muted">{restaurant.neighborhood}</span>
            ) : null}
            {restaurant.dish_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-ink bg-bg px-2 py-0.5 text-[10px] text-ink"
              >
                {tag}
              </span>
            ))}
            {restaurant.is_halal ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border border-accent bg-bg px-2 py-0.5 text-[10px] text-accent"
                title={t('halal')}
              >
                <Wheat className="h-3 w-3" /> {t('halal')}
              </span>
            ) : null}
            {restaurant.has_vegan_options ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border border-accent bg-bg px-2 py-0.5 text-[10px] text-accent"
                title={t('vegan')}
              >
                <Leaf className="h-3 w-3" /> {t('vegan')}
              </span>
            ) : restaurant.has_vegetarian_options ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full border border-accent bg-bg px-2 py-0.5 text-[10px] text-accent"
                title={t('vegetarian')}
              >
                <Sprout className="h-3 w-3" /> {t('vegetarian')}
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  )
}
