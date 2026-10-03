'use client'

import { useState } from 'react'
import { Camera } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Props {
  coverPhotoUrl: string | null
  photoCandidates: string[]
  className?: string
  loading?: 'lazy' | 'eager'
}

export function RestaurantPhoto({ coverPhotoUrl, photoCandidates, className, loading = 'lazy' }: Props) {
  const sources = Array.from(new Set([coverPhotoUrl, ...photoCandidates]
    .filter((src): src is string => typeof src === 'string' && src.trim().length > 0)))

  // A different venue or updated source list starts a fresh attempt sequence.
  return <PhotoAttempt key={JSON.stringify(sources)} sources={sources} className={className} loading={loading} />
}

function PhotoAttempt({ sources, className, loading }: {
  sources: string[]
  className?: string
  loading: 'lazy' | 'eager'
}) {
  const [index, setIndex] = useState(0)
  const t = useTranslations('detail')
  const src = sources[index]

  return (
    <div className={`overflow-hidden bg-[#E9E7DD] ${className ?? ''}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading={loading}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setIndex((current) => current + 1)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center text-brand-deep/70" role="img" aria-label={t('photoUnavailable')}>
          <Camera className="h-6 w-6" aria-hidden="true" />
          <span className="text-[10px] font-medium leading-tight">{t('photoUnavailable')}</span>
        </div>
      )}
    </div>
  )
}
