'use client'

import { Link } from '@/i18n/navigation'
import {
  ArrowLeft,
  MapPin,
  Phone,
  Share2,
  Navigation,
  ExternalLink,
  Leaf,
  Sprout,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { Restaurant } from '@/lib/restaurants'
import { PhotoGallery } from './photo-gallery'

interface Props {
  restaurant: Restaurant
  locale: 'ko' | 'en'
  onBack?: () => void
  inline?: boolean
}

export function RestaurantDetail({ restaurant, locale, onBack, inline = false }: Props) {
  const t = useTranslations('detail')
  const tDietary = useTranslations('listing.dietary')
  const [shareNotice, setShareNotice] = useState(false)

  const isKorean = locale === 'ko'
  const primaryName = isKorean
    ? restaurant.name_ko
    : (restaurant.name_en ?? restaurant.name_ko)
  const secondaryName = isKorean
    ? restaurant.name_en
    : (restaurant.name_en ? restaurant.name_ko : null)

  const kakaoUrl = restaurant.kakao_place_id
    ? `https://place.map.kakao.com/${restaurant.kakao_place_id}`
    : null
  const directionsUrl = `https://map.kakao.com/?eName=${encodeURIComponent(restaurant.name_ko)}&eLat=${restaurant.lat}&eLng=${restaurant.lng}`

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const title = primaryName
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        /* user dismissed; fall through to clipboard */
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url)
        setShareNotice(true)
        setTimeout(() => setShareNotice(false), 2000)
      } catch {
        /* ignore */
      }
    }
  }

  const galleryPhotos = (
    restaurant.photo_candidates.length > 0
      ? restaurant.photo_candidates
      : restaurant.cover_photo_url
        ? [restaurant.cover_photo_url]
        : []
  ).slice(0, 4)

  return (
    <article className={inline ? 'w-full px-1 py-2' : 'mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-6'}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        >
          <ArrowLeft className="h-4 w-4" /> {t('back')}
        </button>
      ) : (
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> {t('back')}
        </Link>
      )}

      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-gradient-to-br from-[#E8DCC8] to-[#D4C4A8]">
        {restaurant.cover_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.cover_photo_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <h1 className="mt-4 font-display text-3xl text-ink sm:text-4xl">{primaryName}</h1>
      {secondaryName ? (
        <p className="mt-1 text-sm text-muted">{secondaryName}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {restaurant.neighborhood ? (
          <span className="text-sm text-muted">{restaurant.neighborhood}</span>
        ) : null}
        {restaurant.dish_tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-ink bg-bg px-2.5 py-0.5 text-xs text-ink"
          >
            {tag}
          </span>
        ))}
        {restaurant.has_vegan_options ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-bg px-2.5 py-0.5 text-xs text-accent">
            <Leaf className="h-3 w-3" /> {tDietary('vegan')}
          </span>
        ) : restaurant.has_vegetarian_options ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-bg px-2.5 py-0.5 text-xs text-accent">
            <Sprout className="h-3 w-3" /> {tDietary('vegetarian')}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-surface px-4 py-1.5 text-sm font-medium text-ink hover:bg-bg"
        >
          <Navigation className="h-4 w-4" /> {t('directions')}
        </a>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-surface px-4 py-1.5 text-sm font-medium text-ink hover:bg-bg"
        >
          <Share2 className="h-4 w-4" /> {t('share')}
        </button>
        {kakaoUrl ? (
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-surface px-4 py-1.5 text-sm font-medium text-ink hover:bg-bg"
          >
            <ExternalLink className="h-4 w-4" /> {t('openInKakao')}
          </a>
        ) : null}
        {shareNotice ? (
          <span className="self-center text-xs text-muted">{t('shareCopied')}</span>
        ) : null}
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">
            {t('address')}
          </dt>
          <dd className="mt-1 flex items-start gap-1 text-sm text-ink">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>{restaurant.address_ko}</span>
          </dd>
        </div>
        {restaurant.phone ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('phone')}
            </dt>
            <dd className="mt-1 flex items-start gap-1 text-sm text-ink">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <a href={`tel:${restaurant.phone}`} className="hover:underline">
                {restaurant.phone}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl text-ink">{t('gallery')}</h2>
        <PhotoGallery photos={galleryPhotos} />
      </section>

      <section className="mt-8 rounded-lg border border-muted bg-bg px-4 py-6 text-center">
        <p className="text-sm text-muted">{t('reviewsComingSoon')}</p>
      </section>
    </article>
  )
}
