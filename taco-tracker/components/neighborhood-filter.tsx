import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

interface Props {
  neighborhoods: string[]
  active: string | null
  basePath: '/' | '/curate'
}

export async function NeighborhoodFilter({ neighborhoods, active, basePath }: Props) {
  const t = await getTranslations('listing')

  return (
    <nav
      aria-label="Neighborhood filter"
      className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-x-visible sm:pb-0"
    >
      <Link
        href={basePath}
        className={chipClass(active === null)}
      >
        {t('allNeighborhoods')}
      </Link>
      {neighborhoods.map((n) => (
        <Link
          key={n}
          href={{ pathname: basePath, query: { neighborhood: n } }}
          className={chipClass(active === n)}
        >
          {n}
        </Link>
      ))}
    </nav>
  )
}

function chipClass(isActive: boolean): string {
  const base =
    'whitespace-nowrap rounded-full border px-3.5 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
  if (isActive) {
    return `${base} border-brand bg-brand text-surface`
  }
  return `${base} border-ink bg-surface text-ink hover:bg-bg`
}
