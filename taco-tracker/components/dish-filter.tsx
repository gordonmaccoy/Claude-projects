import { getTranslations } from 'next-intl/server'
import { FilterChipRow, type ChipOption } from './filter-chip-row'

type DishKey =
  | 'taco' | 'burrito' | 'quesadilla' | 'fajita' | 'nachos' | 'margarita'
  | 'enchilada' | 'guacamole' | 'salsa' | 'tortilla' | 'chipotle'

const DISH_KEYS: readonly DishKey[] = [
  'taco', 'burrito', 'quesadilla', 'fajita', 'nachos', 'margarita',
  'enchilada', 'guacamole', 'salsa', 'tortilla', 'chipotle',
]

function isDishKey(s: string): s is DishKey {
  return (DISH_KEYS as readonly string[]).includes(s)
}

interface Props {
  dishes: string[]
  active: string[]
  basePath: '/' | '/curate'
  currentParams: Record<string, string | undefined>
}

export async function DishFilter({ dishes, active, basePath, currentParams }: Props) {
  const t = await getTranslations('listing.dishes')
  const options: ChipOption[] = dishes.map((d) => ({
    value: d,
    label: isDishKey(d) ? t(d) : d,
  }))
  return (
    <FilterChipRow
      paramName="dish"
      basePath={basePath}
      currentParams={currentParams}
      options={options}
      active={active}
      ariaLabel="Dish filter"
    />
  )
}
