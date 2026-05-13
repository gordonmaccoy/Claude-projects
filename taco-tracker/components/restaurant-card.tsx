import type { Restaurant } from '@/lib/restaurants'
import { getTranslations } from 'next-intl/server'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
}

export async function RestaurantCard({ restaurant, locale }: Props) {
  const t = await getTranslations('listing.dietary')
  const kakaoUrl = restaurant.kakao_place_id
    ? `https://place.map.kakao.com/${restaurant.kakao_place_id}`
    : undefined

  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  const dietaryFlags = [
    restaurant.is_halal ? { key: 'halal', label: t('halal') } : null,
    restaurant.has_vegan_options ? { key: 'vegan', label: t('vegan') } : null,
    restaurant.has_vegetarian_options && !restaurant.has_vegan_options
      ? { key: 'vegetarian', label: t('vegetarian') }
      : null,
  ].filter((x): x is { key: string; label: string } => x !== null)

  const CardContent = (
    <article className="flex overflow-hidden rounded-md bg-surface shadow-card transition-shadow hover:shadow-[0_4px_12px_rgba(27,25,22,0.12)]">
      <div className="relative h-[60px] w-[80px] shrink-0 bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8] sm:h-[80px] sm:w-[120px]">
        {restaurant.cover_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.cover_photo_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-bold leading-tight text-ink">
              {primaryName}
            </div>
            {secondaryName ? (
              <div className="truncate text-xs text-muted">{secondaryName}</div>
            ) : null}
          </div>
          {restaurant.curator_rating !== null ? (
            <div className="whitespace-nowrap text-sm font-semibold text-brand">
              ★ {restaurant.curator_rating.toFixed(1)}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {restaurant.neighborhood ? (
            <span className="text-xs text-muted">{restaurant.neighborhood}</span>
          ) : null}
          {restaurant.dish_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-ink bg-bg px-2.5 py-0.5 text-[11px] text-ink"
            >
              {tag}
            </span>
          ))}
          {dietaryFlags.map((flag) => (
            <span
              key={flag.key}
              className="rounded-full border border-accent bg-bg px-2.5 py-0.5 text-[11px] text-accent"
            >
              {flag.label}
            </span>
          ))}
        </div>
        <div className="truncate text-xs text-muted">{restaurant.address_ko}</div>
      </div>
    </article>
  )

  if (kakaoUrl) {
    return (
      <a
        href={kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {CardContent}
      </a>
    )
  }
  return CardContent
}
