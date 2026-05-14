import { getTranslations } from 'next-intl/server'
import { Leaf, Sprout, Wheat } from 'lucide-react'
import { FilterChipRow, type ChipOption } from './filter-chip-row'

interface Props {
  active: string[]
  basePath: '/' | '/curate'
  currentParams: Record<string, string | undefined>
}

export async function DietaryFilter({ active, basePath, currentParams }: Props) {
  const t = await getTranslations('listing.dietary')
  const options: ChipOption[] = [
    { value: 'vegan', label: t('vegan'), icon: <Leaf className="h-3.5 w-3.5" /> },
    { value: 'vegetarian', label: t('vegetarian'), icon: <Sprout className="h-3.5 w-3.5" /> },
    { value: 'halal', label: t('halal'), icon: <Wheat className="h-3.5 w-3.5" /> },
  ]
  return (
    <FilterChipRow
      paramName="dietary"
      basePath={basePath}
      currentParams={currentParams}
      options={options}
      active={active}
      ariaLabel="Dietary filter"
    />
  )
}
