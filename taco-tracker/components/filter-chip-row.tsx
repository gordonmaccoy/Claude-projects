import { Link } from '@/i18n/navigation'
import type { ReactNode } from 'react'

export interface ChipOption {
  value: string
  label: string
  icon?: ReactNode
}

interface Props {
  /** URL param name, e.g. "neighborhood", "dish", "dietary". */
  paramName: string
  basePath: '/' | '/curate'
  /** All other current search params to preserve when this row updates. */
  currentParams: Record<string, string | undefined>
  options: ChipOption[]
  /** Currently-selected values in this row. */
  active: string[]
  /** Label for the optional clear chip. Omit to hide clear chip. */
  clearLabel?: string
  ariaLabel: string
}

/**
 * Multi-select chip row. Each chip toggles a value in/out of a comma-separated
 * URL param. State lives entirely in the URL; navigations emitted via next-intl Link.
 */
export function FilterChipRow({
  paramName,
  basePath,
  currentParams,
  options,
  active,
  clearLabel,
  ariaLabel,
}: Props) {
  const buildHref = (next: string[]) => {
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(currentParams)) {
      if (k !== paramName && v !== undefined && v !== '') params[k] = v
    }
    if (next.length > 0) params[paramName] = next.join(',')
    return Object.keys(params).length === 0
      ? basePath
      : { pathname: basePath, query: params }
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-x-visible sm:pb-0"
    >
      {clearLabel ? (
        <Link href={buildHref([])} className={chipClass(active.length === 0)}>
          {clearLabel}
        </Link>
      ) : null}
      {options.map((opt) => {
        const isActive = active.includes(opt.value)
        const next = isActive
          ? active.filter((v) => v !== opt.value)
          : [...active, opt.value]
        return (
          <Link
            key={opt.value}
            href={buildHref(next)}
            className={chipClass(isActive)}
          >
            {opt.icon ? (
              <span className="mr-1 inline-flex items-center">{opt.icon}</span>
            ) : null}
            {opt.label}
          </Link>
        )
      })}
    </nav>
  )
}

function chipClass(isActive: boolean): string {
  const base =
    'inline-flex items-center whitespace-nowrap rounded-full border px-3.5 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
  return isActive
    ? `${base} border-brand bg-brand text-surface`
    : `${base} border-ink bg-surface text-ink hover:bg-bg`
}
