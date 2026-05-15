'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal, Star, X } from 'lucide-react'

export interface MapFiltersState {
  showWithoutRatings: boolean
  hideMyRated: boolean   // placeholder, no effect yet
  minRating: number      // 0 = no minimum
  vegetarianOnly: boolean
  veganOnly: boolean
}

export const DEFAULT_MAP_FILTERS: MapFiltersState = {
  showWithoutRatings: true,
  hideMyRated: false,
  minRating: 0,
  vegetarianOnly: false,
  veganOnly: false,
}

export function isFilterDefault(f: MapFiltersState): boolean {
  return (
    f.showWithoutRatings === DEFAULT_MAP_FILTERS.showWithoutRatings &&
    f.hideMyRated === DEFAULT_MAP_FILTERS.hideMyRated &&
    f.minRating === DEFAULT_MAP_FILTERS.minRating &&
    f.vegetarianOnly === DEFAULT_MAP_FILTERS.vegetarianOnly &&
    f.veganOnly === DEFAULT_MAP_FILTERS.veganOnly
  )
}

interface Props {
  filters: MapFiltersState
  onApply: (next: MapFiltersState) => void
  /** compact=true → smaller pill, text always visible (for the mobile control row) */
  compact?: boolean
}

export function MapFilters({ filters, onApply, compact }: Props) {
  const t = useTranslations('listing.mapFilters')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<MapFiltersState>(filters)
  const active = !isFilterDefault(filters)

  // Sync draft when modal opens (so reopening reflects current applied state)
  useEffect(() => {
    setDraft(filters)
  }, [filters])

  const open = () => {
    setDraft(filters)
    dialogRef.current?.showModal()
  }
  const close = () => dialogRef.current?.close()

  const handleApply = () => {
    onApply(draft)
    close()
  }
  const handleReset = () => {
    setDraft(DEFAULT_MAP_FILTERS)
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={`inline-flex ${compact ? 'h-9' : 'h-10'} items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          active
            ? 'border-brand bg-brand text-surface'
            : 'border-ink bg-surface text-ink hover:bg-bg'
        }`}
        aria-label={t('buttonLabel')}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className={compact ? undefined : 'hidden sm:inline'}>{t('buttonLabel')}</span>
        {compact && active ? <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-current" /> : null}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close()
        }}
        onCancel={(e) => {
          e.preventDefault()
          close()
        }}
        className="m-auto w-[min(420px,92vw)] rounded-lg bg-surface p-0 backdrop:bg-ink/40"
      >
        <div className="flex items-center justify-between border-b border-muted/30 px-4 py-3">
          <h2 className="font-display text-lg text-ink">{t('modalTitle')}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <ToggleRow
            label={t('showWithoutRatings')}
            hint={t('showWithoutRatingsHint')}
            checked={draft.showWithoutRatings}
            onChange={(v) => setDraft({ ...draft, showWithoutRatings: v })}
          />
          <ToggleRow
            label={t('hideMyRated')}
            hint={t('comingSoon')}
            checked={draft.hideMyRated}
            onChange={(v) => setDraft({ ...draft, hideMyRated: v })}
            disabledLook
          />
          <div className="flex flex-col gap-1.5">
            <div className="text-sm text-ink">{t('ratingsTitle')}</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const isOn = draft.minRating >= n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, minRating: draft.minRating === n ? 0 : n })
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-muted/50 hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label={`${n}+`}
                  >
                    <Star
                      className={`h-5 w-5 ${
                        isOn ? 'fill-brand text-brand' : 'text-muted'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
            <div className="text-xs text-muted">{t('ratingsHint')}</div>
          </div>
          <ToggleRow
            label={t('vegetarianOnly')}
            checked={draft.vegetarianOnly}
            onChange={(v) => setDraft({ ...draft, vegetarianOnly: v })}
          />
          <ToggleRow
            label={t('veganOnly')}
            checked={draft.veganOnly}
            onChange={(v) => setDraft({ ...draft, veganOnly: v })}
          />
        </div>

        <div className="flex gap-2 border-t border-muted/30 px-4 py-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 rounded-full border border-ink bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {t('reset')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 rounded-full bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-brand-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {t('apply')}
          </button>
        </div>
      </dialog>
    </>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabledLook,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabledLook?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <div className="flex flex-col">
        <span className={`text-sm ${disabledLook ? 'text-muted' : 'text-ink'}`}>{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </label>
  )
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
        checked ? 'bg-brand' : 'bg-muted/40'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
