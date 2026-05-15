'use client'

import { Compass, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Props {
  active: boolean
  locating: boolean
  onClick: () => void
  onClear: () => void
  /** compact=true → smaller pill, text always visible (for the mobile control row) */
  compact?: boolean
}

export function NearMeButton({ active, locating, onClick, onClear, compact }: Props) {
  const t = useTranslations('listing.nearMe')
  const h = compact ? 'h-9' : 'h-10'

  if (active) {
    return (
      <div className={`inline-flex ${h} items-center gap-1.5 rounded-full border border-brand bg-brand pl-3 pr-1.5 text-sm text-surface`}>
        <Compass className="h-4 w-4" />
        <span className={compact ? undefined : 'hidden sm:inline'}>{t('active')}</span>
        <button
          type="button"
          onClick={onClear}
          aria-label={t('clear')}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full hover:bg-brand-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-surface"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locating}
      className={`inline-flex ${h} items-center gap-1.5 rounded-full border border-ink bg-surface px-3 text-sm text-ink hover:bg-bg disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
    >
      <Compass className="h-4 w-4" />
      <span className={compact ? undefined : 'hidden sm:inline'}>
        {locating ? t('locating') : t('buttonLabel')}
      </span>
    </button>
  )
}
