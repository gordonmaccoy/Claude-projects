'use client'

import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Props {
  value: string
  onChange: (next: string) => void
}

export function SearchBar({ value, onChange }: Props) {
  const t = useTranslations('listing')
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="h-10 w-full rounded-full border border-ink bg-surface pl-10 pr-10 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
