import { getTranslations } from 'next-intl/server'
import { FilterChipRow, type ChipOption } from './filter-chip-row'

interface Props {
  neighborhoods: string[]
  active: string[]
  basePath: '/' | '/curate'
  currentParams: Record<string, string | undefined>
}

export async function NeighborhoodFilter({
  neighborhoods,
  active,
  basePath,
  currentParams,
}: Props) {
  const t = await getTranslations('listing')
  const options: ChipOption[] = neighborhoods.map((n) => ({ value: n, label: n }))
  return (
    <FilterChipRow
      paramName="neighborhood"
      basePath={basePath}
      currentParams={currentParams}
      options={options}
      active={active}
      clearLabel={t('allNeighborhoods')}
      ariaLabel="Neighborhood filter"
    />
  )
}
